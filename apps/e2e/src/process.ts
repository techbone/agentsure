import { spawn, type ChildProcess } from "node:child_process";

export function shouldForwardGuardianLine(line: string): boolean {
  try {
    const value = JSON.parse(line) as { level?: unknown };
    return value.level !== "debug";
  } catch {
    return true;
  }
}

export async function runCaptured(
  command: string,
  args: string[],
  options: { cwd: string; environment?: NodeJS.ProcessEnv },
): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.environment ?? process.env,
      stdio: ["inherit", "pipe", "inherit"],
    });
    let output = "";
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      output += chunk;
    });
    child.once("error", reject);
    child.once("close", (code) => {
      if (code === 0) {
        resolve(output.trim());
        return;
      }
      reject(new Error(`${command} exited with code ${code ?? "unknown"}`));
    });
  });
}

export function spawnGuardian(options: {
  cwd: string;
  environment: NodeJS.ProcessEnv;
}): ChildProcess {
  const child = spawn(process.execPath, ["--import", "tsx", "apps/guardian/src/keystore-main.ts"], {
    cwd: options.cwd,
    env: options.environment,
    stdio: ["inherit", "pipe", "inherit"],
  });
  let buffered = "";
  child.stdout?.setEncoding("utf8");
  child.stdout?.on("data", (chunk: string) => {
    buffered += chunk;
    const lines = buffered.split("\n");
    buffered = lines.pop() ?? "";
    for (const line of lines) {
      if (shouldForwardGuardianLine(line)) process.stdout.write(`${line}\n`);
    }
  });
  child.stdout?.on("close", () => {
    if (buffered.length > 0 && shouldForwardGuardianLine(buffered)) {
      process.stdout.write(`${buffered}\n`);
    }
  });
  return child;
}

export async function stopProcess(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null) return;
  child.kill("SIGTERM");
  await Promise.race([
    new Promise<void>((resolve) => child.once("close", () => resolve())),
    new Promise<void>((resolve) => setTimeout(resolve, 5_000)),
  ]);
  if (child.exitCode === null) child.kill("SIGKILL");
}
