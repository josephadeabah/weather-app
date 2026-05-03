import type { Metadata } from "next";
import "../styles/globals.css";

export const metadata: Metadata = {
  title: "WeatherIQ — Weather Intelligence App",
  description: "Real-time weather intelligence by [Your Name] | Built for PM Accelerator Technical Assessment",
  keywords: "weather, forecast, real-time, weather app, PM Accelerator",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🌤</text></svg>" />
      </head>
      <body>{children}</body>
    </html>
  );
}
