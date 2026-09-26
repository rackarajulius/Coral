 import { useState, useEffect, useCallback } from "react";
 
 export interface CookiePreferences {
   necessary: boolean;
   functional: boolean;
   analytics: boolean;
   marketing: boolean;
 }
 
 const COOKIE_CONSENT_KEY = "cookie-consent";
 const COOKIE_PREFERENCES_KEY = "cookie-preferences";
 
 const defaultPreferences: CookiePreferences = {
   necessary: true, // Always required
   functional: false,
   analytics: false,
   marketing: false,
 };
 
 export function useCookieConsent() {
   const [hasConsented, setHasConsented] = useState<boolean | null>(null);
   const [preferences, setPreferences] = useState<CookiePreferences>(defaultPreferences);
   const [showBanner, setShowBanner] = useState(false);
   const [showPreferences, setShowPreferences] = useState(false);
 
   // Load saved consent on mount
   useEffect(() => {
     const savedConsent = localStorage.getItem(COOKIE_CONSENT_KEY);
     const savedPreferences = localStorage.getItem(COOKIE_PREFERENCES_KEY);
 
     if (savedConsent !== null) {
       setHasConsented(savedConsent === "true");
       if (savedPreferences) {
         try {
           setPreferences(JSON.parse(savedPreferences));
         } catch {
           setPreferences(defaultPreferences);
         }
       }
       setShowBanner(false);
     } else {
       setShowBanner(true);
     }
   }, []);
 
   const saveConsent = useCallback((prefs: CookiePreferences) => {
     localStorage.setItem(COOKIE_CONSENT_KEY, "true");
     localStorage.setItem(COOKIE_PREFERENCES_KEY, JSON.stringify(prefs));
     setPreferences(prefs);
     setHasConsented(true);
     setShowBanner(false);
     setShowPreferences(false);
   }, []);
 
   const acceptAll = useCallback(() => {
     saveConsent({
       necessary: true,
       functional: true,
       analytics: true,
       marketing: true,
     });
   }, [saveConsent]);
 
   const rejectAll = useCallback(() => {
     saveConsent({
       necessary: true, // Always required
       functional: false,
       analytics: false,
       marketing: false,
     });
   }, [saveConsent]);
 
   const saveCustomPreferences = useCallback((prefs: CookiePreferences) => {
     saveConsent({ ...prefs, necessary: true }); // Ensure necessary is always true
   }, [saveConsent]);
 
   const openPreferences = useCallback(() => {
     setShowPreferences(true);
   }, []);
 
   const closePreferences = useCallback(() => {
     setShowPreferences(false);
   }, []);
 
   return {
     hasConsented,
     preferences,
     showBanner,
     showPreferences,
     acceptAll,
     rejectAll,
     saveCustomPreferences,
     openPreferences,
     closePreferences,
     setPreferences,
   };
 }