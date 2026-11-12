'use client';
import Script from 'next/script';
/** Optional web push via OneSignal. Renders nothing unless NEXT_PUBLIC_ONESIGNAL_APP_ID is set. `userId` links pushes to the signed-in player. */
export function OneSignalInit({ userId }: { userId: string }) {
  const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;
  if (!appId) return null;
  return (
    <>
      <Script src="https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js" strategy="afterInteractive" defer />
      <Script id="onesignal-init" strategy="afterInteractive">{`window.OneSignalDeferred = window.OneSignalDeferred || [];
OneSignalDeferred.push(async function (OneSignal) { await OneSignal.init({ appId: ${JSON.stringify(appId)}, allowLocalhostAsSecureOrigin: true }); await OneSignal.login(${JSON.stringify(userId)}); });`}</Script>
    </>
  );
}
