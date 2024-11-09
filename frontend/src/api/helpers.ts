import axios, { AxiosError } from 'axios';

export function axiosErrorHandler(error: AxiosError | unknown): void {
  if (error === null) throw new Error('Unrecoverable error!! Error is null!');

  if (axios.isAxiosError(error)) {
    // TypeScript now knows `error` is an AxiosError
    const response = error.response;
    const request = error.request;
    // const config = error.config;

    if (error.code === 'ERR_NETWORK') {
      console.log('Connection problems..');
    } else if (error.code === 'ERR_CANCELED') {
      console.log('Connection canceled..');
    }

    if (response) {
      const statusCode = response.status;
      if (statusCode === 404) {
        console.log(
          'The requested resource does not exist or has been deleted',
        );
      } else if (statusCode === 401) {
        console.log('Please login to access this resource');
        // Redirect user to login
      }
    } else if (request) {
      console.log('No response received from the server.');
    }
  } else if (error instanceof Error) {
    console.log(error.message);
  } else {
    console.log('An unknown error occurred:', error);
  }
}
