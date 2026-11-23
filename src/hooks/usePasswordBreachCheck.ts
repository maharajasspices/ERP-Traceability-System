
import { useState, useCallback } from 'react';

export const usePasswordBreachCheck = () => {
  const [isChecking, setIsChecking] = useState(false);
  const [breachCount, setBreachCount] = useState<number | null>(null);

  const checkPassword = useCallback(async (
    password: string
  ): Promise<{ isBreached: boolean; count: number }> => {
    setIsChecking(true);
    setBreachCount(null);

    try {
      // Check whether Web Crypto is available
      if (
        typeof globalThis.crypto === 'undefined' ||
        !globalThis.crypto.subtle ||
        typeof TextEncoder === 'undefined'
      ) {
        console.warn('Password breach check unavailable. Continuing login.');
        return { isBreached: false, count: 0 };
      }

      // Generate SHA-1 hash
      const encoder = new TextEncoder();
      const data = encoder.encode(password);

      const hashBuffer = await globalThis.crypto.subtle.digest(
        'SHA-1',
        data
      );

      const hashArray = Array.from(new Uint8Array(hashBuffer));

      const hashHex = hashArray
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')
        .toUpperCase();

      // HIBP k-Anonymity
      const prefix = hashHex.substring(0, 5);
      const suffix = hashHex.substring(5);

      const response = await fetch(
        `https://api.pwnedpasswords.com/range/${prefix}`,
        {
          headers: {
            'Add-Padding': 'true',
          },
        }
      );

      if (!response.ok) {
        console.warn('HIBP request failed. Continuing login.');
        return { isBreached: false, count: 0 };
      }

      const result = await response.text();

      const match = result
        .split('\n')
        .find(line => line.split(':')[0].trim() === suffix);

      if (match) {
        const count = parseInt(match.split(':')[1].trim(), 10);

        setBreachCount(count);

        return { isBreached: true, count };
      }

      return { isBreached: false, count: 0 };

    } catch (error) {
      console.warn('Password breach check failed:', error);

      // Never prevent authentication because of this check
      return { isBreached: false, count: 0 };

    } finally {
      setIsChecking(false);
    }
  }, []);

  return {
    checkPassword,
    isChecking,
    breachCount,
  };
};
