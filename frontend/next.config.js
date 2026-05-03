/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
    NEXT_PUBLIC_MAPS_API_KEY: process.env.NEXT_PUBLIC_MAPS_API_KEY || '',
  },
  images: {
    domains: ['openweathermap.org', 'i.ytimg.com', 'maps.googleapis.com'],
  },
  output: 'standalone'
}

module.exports = nextConfig
