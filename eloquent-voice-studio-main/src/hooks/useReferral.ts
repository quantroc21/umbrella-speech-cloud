import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

export const useReferral = () => {
    const [searchParams] = useSearchParams();

    useEffect(() => {
        const refCode = searchParams.get('ref');
        if (refCode) {
            // Store the referral code permanently (or until cleared)
            // Later, during Sign Up, we will grab this from localStorage
            localStorage.setItem('referral_code', refCode);
            console.log('✅ Affiliate Tracking: Captured code', refCode);
        }
    }, [searchParams]);
};
