// Suppress hydration warnings in development caused by browser extensions
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  const originalError = console.error;
  console.error = (...args) => {
    const message = args[0];
    
    // Suppress hydration mismatch warnings caused by browser extensions
    if (
      typeof message === 'string' && 
      (
        message.includes('A tree hydrated but some attributes of the server rendered HTML didn\'t match') ||
        message.includes('keychainify-checked') ||
        message.includes('Hydration failed because the initial UI does not match')
      )
    ) {
      return; // Suppress this error
    }
    
    // Allow all other errors through
    originalError.apply(console, args);
  };
}
