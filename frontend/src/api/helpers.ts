/**
 * @author Michael Polívka (xpoliv07)
 * Enhanced error handler for API requests that provides detailed error information
 */
import { useQuasar } from 'quasar';
import axios, { AxiosError } from 'axios';

interface ErrorResponse {
  message?: string;
  error?: string;
  errors?: string[] | Record<string, string[]>;
  details?: unknown;
}

/**
 * Enhanced error handler for API requests
 * Handles various error scenarios and provides detailed error information
 *
 * @param error The error to handle
 * @param customHandler Optional custom handler for specific error scenarios
 * @param showNotification Whether to show a notification for this error (default: false)
 * @returns The processed error message
 */
export function axiosErrorHandler(
  error: AxiosError | unknown,
  customHandler?: (error: AxiosError | unknown) => void,
  showNotification = false,
): string {
  // Default error message
  let errorMessage = 'An unknown error occurred';
  let notificationType: 'negative' | 'warning' = 'negative';
  let notificationTimeout = 5000;

  if (error === null || error === undefined) {
    errorMessage = 'Unrecoverable error!! Error is null or undefined!';
    if (customHandler) customHandler(error);
    return errorMessage;
  }

  if (axios.isAxiosError(error)) {
    const response = error.response;
    const request = error.request;
    const config = error.config;

    // Network errors
    if (error.code === 'ERR_NETWORK') {
      errorMessage =
        'Network error: Unable to connect to the server. Please check your internet connection.';
      notificationTimeout = 0; // No timeout for connection errors
    } else if (error.code === 'ERR_CANCELED') {
      errorMessage = 'Request was cancelled';
      notificationType = 'warning';
    } else if (error.code === 'ECONNABORTED') {
      errorMessage =
        'Request timeout: The server took too long to respond. Please try again later.';
    }

    // Response exists - server responded with an error
    if (response) {
      const statusCode = response.status;
      const responseData = response.data as ErrorResponse;

      // Extract message from response if available
      if (responseData) {
        if (responseData.message) {
          errorMessage = responseData.message;
        } else if (responseData.error) {
          errorMessage = responseData.error;
        } else if (responseData.errors) {
          if (Array.isArray(responseData.errors)) {
            errorMessage = responseData.errors.join(', ');
          } else {
            // Handle object of errors
            const errMsgs: string[] = [];
            Object.entries(responseData.errors).forEach(([field, messages]) => {
              if (Array.isArray(messages)) {
                errMsgs.push(`${field}: ${messages.join(', ')}`);
              } else {
                errMsgs.push(`${field}: ${messages}`);
              }
            });
            errorMessage = errMsgs.join('; ');
          }
        }
      }

      // Handle specific status codes
      switch (statusCode) {
        case 400:
          if (!errorMessage || errorMessage === 'An unknown error occurred') {
            errorMessage =
              'Invalid request. Please check your data and try again.';
          }
          notificationType = 'warning';
          break;
        case 401:
          errorMessage = 'You are not authorized. Please log in again.';
          break;
        case 403:
          errorMessage = 'You do not have permission to perform this action.';
          break;
        case 404:
          errorMessage =
            'The requested resource does not exist or has been moved.';
          notificationType = 'warning';
          break;
        case 408:
          errorMessage = 'Request timed out. Please try again.';
          break;
        case 409:
          errorMessage =
            'This operation resulted in a conflict. Please refresh and try again.';
          notificationType = 'warning';
          break;
        case 422:
          if (!errorMessage || errorMessage === 'An unknown error occurred') {
            errorMessage =
              'Validation failed. Please check your input and try again.';
          }
          notificationType = 'warning';
          break;
        case 429:
          errorMessage = 'Too many requests. Please try again later.';
          break;
        case 500:
          errorMessage =
            'Server error. Please try again later or contact support.';
          break;
        case 502:
          errorMessage = 'Server is unavailable. Please try again later.';
          break;
        case 503:
          errorMessage =
            'Service is temporarily unavailable. Please try again later.';
          break;
        default:
          if (!errorMessage || errorMessage === 'An unknown error occurred') {
            errorMessage = `Unexpected error (${statusCode}). Please try again or contact support.`;
          }
      }
    }
    // No response - request was made but no response received
    else if (request) {
      errorMessage =
        'No response received from the server. Please check your connection and try again.';
      notificationTimeout = 0; // No timeout for connection errors
    }
    // Something happened in setting up the request that triggered an Error
    else if (config) {
      errorMessage =
        'Error in request configuration. Please try again or contact support.';
    }
  }
  // Not an Axios error
  else if (error instanceof Error) {
    errorMessage = error.message || 'An application error occurred';
  }
  // Unknown error type
  else {
    try {
      errorMessage = error as string;
    } catch (e) {
      errorMessage =
        'An unknown error occurred. Please try again or contact support.';
    }
  }

  // Show notification if requested
  if (showNotification) {
    try {
      const $q = useQuasar();

      $q.notify({
        type: notificationType,
        message: errorMessage,
        timeout: notificationTimeout,
        actions:
          notificationTimeout === 0
            ? [
                {
                  label: 'Dismiss',
                  color: 'white',
                  handler: () => {
                    /* Just dismiss */
                  },
                },
              ]
            : undefined,
      });
    } catch (e) {
      // Error showing notification
    }
  }

  // Call custom handler if provided
  if (customHandler) {
    customHandler(error);
  }

  return errorMessage;
}
