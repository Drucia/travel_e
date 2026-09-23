import { ScrollViewStyleReset } from 'expo-router/html';
import type { ReactNode } from 'react';

export default function Root({ children }: { children: ReactNode }) {
  return (
    <html lang="pl">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"
        />
        <meta name="theme-color" content="#F5C400" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="Ewidencja" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="application-name" content="Ewidencja" />
        <meta name="description" content="Ewidencja treningów, meczów i dojazdów" />
        <link rel="manifest" href="/travel_e/manifest.webmanifest" />
        <link rel="icon" href="/travel_e/icon.png" />
        <link rel="apple-touch-icon" href="/travel_e/apple-touch-icon.png" />
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: responsiveBackground }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

const responsiveBackground = `
html, body, #root {
  height: 100%;
  height: 100dvh;
  max-height: 100dvh;
  min-height: 100dvh;
  overflow: hidden;
}
body {
  background-color: #F7F6F2;
  margin: 0;
}
#root {
  display: flex;
  flex-direction: column;
}
`;
