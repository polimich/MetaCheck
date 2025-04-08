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
 * @returns The processed error message
 */
export function axiosErrorHandler(
  error: AxiosError | unknown,
  customHandler?: (error: AxiosError | unknown) => void,
): string {
  // Default error message
  let errorMessage = 'An unknown error occurred';

  if (error === null || error === undefined) {
    errorMessage = 'Unrecoverable error!! Error is null or undefined!';
    console.error(errorMessage);
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
      console.error('Connection problems..', error);
    } else if (error.code === 'ERR_CANCELED') {
      errorMessage = 'Request was cancelled';
      console.warn('Connection canceled..', error);
    } else if (error.code === 'ECONNABORTED') {
      errorMessage =
        'Request timeout: The server took too long to respond. Please try again later.';
      console.error('Connection timed out..', error);
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
          console.error('Bad request:', errorMessage, response.data);
          if (!errorMessage || errorMessage === 'An unknown error occurred') {
            errorMessage =
              'Invalid request. Please check your data and try again.';
          }
          break;
        case 401:
          console.error('Unauthorized:', errorMessage);
          errorMessage = 'You are not authorized. Please log in again.';
          // You could trigger a logout or redirect to login here
          break;
        case 403:
          console.error('Forbidden:', errorMessage);
          errorMessage = 'You do not have permission to perform this action.';
          break;
        case 404:
          console.error('Not found:', errorMessage);
          errorMessage =
            'The requested resource does not exist or has been moved.';
          break;
        case 408:
          console.error('Request timeout:', errorMessage);
          errorMessage = 'Request timed out. Please try again.';
          break;
        case 409:
          console.error('Conflict:', errorMessage);
          errorMessage =
            'This operation resulted in a conflict. Please refresh and try again.';
          break;
        case 422:
          console.error('Validation error:', errorMessage, response.data);
          if (!errorMessage || errorMessage === 'An unknown error occurred') {
            errorMessage =
              'Validation failed. Please check your input and try again.';
          }
          break;
        case 429:
          console.error('Too many requests:', errorMessage);
          errorMessage = 'Too many requests. Please try again later.';
          break;
        case 500:
          console.error('Server error:', errorMessage);
          errorMessage =
            'Server error. Please try again later or contact support.';
          break;
        case 502:
          console.error('Bad gateway:', errorMessage);
          errorMessage = 'Server is unavailable. Please try again later.';
          break;
        case 503:
          console.error('Service unavailable:', errorMessage);
          errorMessage =
            'Service is temporarily unavailable. Please try again later.';
          break;
        default:
          console.error(`Unexpected status (${statusCode}):`, errorMessage);
          if (!errorMessage || errorMessage === 'An unknown error occurred') {
            errorMessage = `Unexpected error (${statusCode}). Please try again or contact support.`;
          }
      }
    }
    // No response - request was made but no response received
    else if (request) {
      console.error('No response from server:', error);
      errorMessage =
        'No response received from the server. Please check your connection and try again.';
    }
    // Something happened in setting up the request that triggered an Error
    else if (config) {
      console.error('Request configuration error:', error);
      errorMessage =
        'Error in request configuration. Please try again or contact support.';
    }
  }
  // Not an Axios error
  else if (error instanceof Error) {
    console.error('JavaScript error:', error);
    errorMessage = error.message || 'An application error occurred';
  }
  // Unknown error type
  else {
    console.error('Unknown error type:', error);
    try {
      errorMessage = error as string;
    } catch (e) {
      errorMessage =
        'An unknown error occurred. Please try again or contact support.';
    }
  }

  // Call custom handler if provided
  if (customHandler) {
    customHandler(error);
  }

  return errorMessage;
}
