export interface StartFailure {
  title: string;
  message: string;
  canRetry: boolean;
}

// What a candidate sees when the interview could not start. Never says "complete":
// a candidate who was not interviewed must not believe they finished.
export function describeStartFailure(code?: string): StartFailure {
  switch (code) {
    case "invalid_link":
    case "auth_failed":
      return {
        title: "This interview link isn't valid",
        message: "The link may have expired or been copied incorrectly. Please contact the hiring team for a new one.",
        canRetry: false,
      };
    case "no_system_prompt":
      return {
        title: "This interview isn't ready yet",
        message: "The hiring team is still setting it up. Please try again later or contact them.",
        canRetry: false,
      };
    case "session_start_failed":
      return {
        title: "We couldn't start your interview",
        message: "Something went wrong on our side. Please try again.",
        canRetry: true,
      };
    default:
      return {
        title: "We couldn't start your interview",
        message: "Please check your connection and try again.",
        canRetry: true,
      };
  }
}
