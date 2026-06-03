// Minimal Deno namespace stubs for VS Code TypeScript language server.
// The Deno runtime supplies the real implementations at deploy time.
declare namespace Deno {
  function serve(handler: (req: Request) => Response | Promise<Response>): void;
  namespace env {
    function get(key: string): string | undefined;
  }
}
