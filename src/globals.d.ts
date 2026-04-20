declare const process: {
  env: Record<string, string | undefined>;
  exit(code?: number): never;
  on(event: "SIGINT" | "SIGTERM", handler: () => void): void;
};
