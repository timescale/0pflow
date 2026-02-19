import { useDeploy } from "../hooks/useDeploy";

export function DeployPanel() {
  const deploy = useDeploy();

  return (
    <div className="border-t border-border pt-3">
      <p className="text-[11px] uppercase tracking-wider text-[#a8a099] mb-2 px-1">
        Deploy
      </p>

      {deploy.status === "idle" && (
        <button
          onClick={deploy.startDeploy}
          className="w-full px-3 py-1.5 text-xs bg-foreground text-background rounded hover:opacity-90 transition-opacity cursor-pointer"
        >
          Deploy to Cloud
        </button>
      )}

      {deploy.status === "deploying" && (
        <div className="text-xs text-muted-foreground px-1 flex items-center gap-2">
          <svg
            className="animate-spin h-3 w-3"
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          <span>{deploy.message ?? "Deploying..."}</span>
        </div>
      )}

      {deploy.status === "success" && (
        <div className="text-xs px-1">
          <p className="text-green-400 mb-1">Deployed successfully!</p>
          {deploy.url && (
            <a
              href={deploy.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 underline break-all"
            >
              {deploy.url}
            </a>
          )}
          <button
            onClick={deploy.reset}
            className="mt-2 block text-muted-foreground hover:text-foreground underline cursor-pointer"
          >
            Done
          </button>
        </div>
      )}

      {deploy.status === "error" && (
        <div className="text-xs px-1">
          <p className="text-red-400 mb-1">{deploy.error}</p>
          <button
            onClick={deploy.reset}
            className="text-muted-foreground hover:text-foreground underline cursor-pointer"
          >
            Try again
          </button>
        </div>
      )}
    </div>
  );
}
