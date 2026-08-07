import { useState, useCallback } from 'react';

/**
 * Uses the Have I Been Pwned API with k-Anonymity model.
 * Only the first 5 characters of the SHA-1 hash are sent to the API,
 * making it secure and privacy-preserving.
 * This is a free alternative to Supabase's leaked password protection.
 */
export const usePasswordBreachCheck = () => {
  const [isChecking, setIsChecking] = useState(false);
  const [breachCount, setBreachCount] = useState<number | null>(null);

  const checkPassword = useCallback(async (password: string): Promise<{ isBreached: boolean; count: number }> => {
    setIsChecking(true);
    setBreachCount(null);

    try {
      // Generate SHA-1 hash of the password
      const encoder = new TextEncoder();
      const data = encoder.encode(password);
      const hashBuffer = await crypto.subtle.digest('SHA-1', data);
      
      // Convert hash to hex string
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
      
      // k-Anonymity: Only send first 5 characters
      const prefix = hashHex.substring(0, 5);
      const suffix = hashHex.substring(5);

      // Query HIBP API
      const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
        headers: {
          'Add-Padding': 'true', // Adds padding to prevent response length analysis
        },
      });

      if (!response.ok) {
        console.warn('HIBP API request failed, allowing login');
        return { isBreached: false, count: 0 };
      }

      const text = await response.text();
      const lines = text.split('\n');

      // Check if our suffix is in the response
      for (const line of lines) {
        const [hashSuffix, countStr] = line.split(':');
        if (hashSuffix.trim() === suffix) {
          const count = parseInt(countStr.trim(), 10);
          setBreachCount(count);
          return { isBreached: true, count };
        }
      }

      return { isBreached: false, count: 0 };
    } catch (error) {
      // On error, don't block login - just log warning
      console.warn('Password breach check failed:', error);
      return { isBreached: false, count: 0 };
    } finally {
      setIsChecking(false);
    }
  }, []);

  return { checkPassword, isChecking, breachCount };
};
