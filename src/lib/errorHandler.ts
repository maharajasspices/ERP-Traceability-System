/**
 * Error handler utility for user-friendly error messages
 * Maps database and API errors to safe, non-revealing messages
 */

export function mapDatabaseError(error: any): string {
  const message = error?.message?.toLowerCase() || '';
  
  // Duplicate/unique constraint violations
  if (message.includes('duplicate key') || message.includes('unique constraint')) {
    return 'This record already exists. Please use a different identifier.';
  }
  
  // Foreign key violations
  if (message.includes('foreign key') || message.includes('violates foreign key')) {
    return 'Cannot complete this action due to related records.';
  }
  
  // Check constraint violations
  if (message.includes('violates check constraint') || message.includes('check constraint')) {
    return 'Invalid value provided. Please check your input.';
  }
  
  // Not null violations
  if (message.includes('not-null') || message.includes('null value') || message.includes('cannot be null')) {
    return 'A required field is missing. Please fill in all required fields.';
  }
  
  // Invalid UUID
  if (message.includes('invalid input syntax for type uuid')) {
    return 'Invalid record reference. Please try again.';
  }
  
  // Row-level security violations
  if (message.includes('row-level security') || message.includes('rls')) {
    return 'You do not have permission to perform this action.';
  }
  
  // Permission/access denied
  if (message.includes('permission denied') || message.includes('access denied')) {
    return 'You do not have permission to perform this action.';
  }
  
  // Network/connection errors
  if (message.includes('network') || message.includes('connection') || message.includes('timeout')) {
    return 'Connection error. Please check your internet connection and try again.';
  }
  
  // Rate limiting
  if (message.includes('rate limit') || message.includes('too many requests')) {
    return 'Too many requests. Please wait a moment and try again.';
  }
  
  // Generic fallback - never expose raw database errors
  return 'An error occurred while processing your request. Please try again.';
}

export function mapAuthError(error: any): string {
  const message = error?.message?.toLowerCase() || '';
  
  // Invalid credentials
  if (message.includes('invalid login credentials') || message.includes('invalid password')) {
    return 'Invalid email or password. Please check your credentials.';
  }
  
  // Email already registered
  if (message.includes('already registered') || message.includes('email already')) {
    return 'This email is already registered. Please sign in instead.';
  }
  
  // Invalid email format
  if (message.includes('invalid email')) {
    return 'Please enter a valid email address.';
  }
  
  // Password too weak
  if (message.includes('password') && (message.includes('weak') || message.includes('short') || message.includes('minimum'))) {
    return 'Password is too weak. Please use at least 6 characters.';
  }
  
  // Email not confirmed
  if (message.includes('email not confirmed')) {
    return 'Please verify your email address before signing in.';
  }
  
  // User not found
  if (message.includes('user not found')) {
    return 'No account found with this email. Please sign up first.';
  }
  
  // Rate limiting
  if (message.includes('rate limit') || message.includes('too many')) {
    return 'Too many attempts. Please wait a moment before trying again.';
  }
  
  // Generic fallback
  return 'Authentication error. Please try again.';
}
