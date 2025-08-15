import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Check environment configuration
    const config = {
      nodeEnv: process.env.NODE_ENV,
      dockerEnv: process.env.DOCKER_ENV,
      nextAuthUrl: process.env.NEXTAUTH_URL,
      nextAuthUrlInternal: process.env.NEXTAUTH_URL_INTERNAL,
      backendUrl: process.env.NEXT_PUBLIC_BACKEND_URL,
      isServerSide: typeof window === 'undefined',
    };

    // Get the backend URL that would be used for API calls
    const getApiUrl = () => {
      if (typeof window === 'undefined' && process.env.NODE_ENV === 'production' && process.env.DOCKER_ENV) {
        return process.env.NEXT_PUBLIC_BACKEND_URL?.replace('localhost', 'backend') || 'http://backend:8003';
      }
      return process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8003';
    };

    return NextResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      config,
      effectiveApiUrl: getApiUrl(),
    });
  } catch (error) {
    console.error('Health check error:', error);
    return NextResponse.json(
      { 
        status: 'error', 
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      }, 
      { status: 500 }
    );
  }
}
