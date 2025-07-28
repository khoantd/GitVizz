// app/api/github/installations/route.ts

import { NextRequest, NextResponse } from 'next/server';

interface GitHubInstallation {
  id: number;
  account: {
    login: string;
    id: number;
    avatar_url: string;
    [key: string]: unknown;
  };
  app_id: number;
  target_type: string;
  [key: string]: unknown;
}

interface GitHubInstallationResponse {
  total_count: number;
  installations: GitHubInstallation[];
}

interface GitHubUser {
  id: number;
  login: string;
  [key: string]: unknown;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const authHeader = req.headers.get('authorization');
  const accessToken = authHeader?.split(' ')[1];

  if (!accessToken) {
    return NextResponse.json({ error: 'Missing access token' }, { status: 401 });
  }

  try {
    // Get the current authenticated user's information
    const userRes = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github+json',
      },
    });

    if (!userRes.ok) {
      const errorData = await userRes.json();
      return NextResponse.json(
        { error: errorData.message || 'Failed to fetch user information' },
        { status: userRes.status }
      );
    }

    const user = (await userRes.json()) as GitHubUser;

    // Get user installations
    const installationsRes = await fetch('https://api.github.com/user/installations', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github+json',
      },
    });

    if (!installationsRes.ok) {
      const errorData = await installationsRes.json();
      return NextResponse.json(
        { error: errorData.message || 'Failed to fetch installations' },
        { status: installationsRes.status }
      );
    }

    const installationsData = (await installationsRes.json()) as GitHubInstallationResponse;

    // Filter installations to only include those where the app is installed on the user's account
    const userInstallations = installationsData.installations.filter(installation => {
      // Check if the installation is on the user's personal account
      if (installation.account.id === user.id) {
        return true;
      }
      
      // This is a more complex check that we'll handle in the app_repos endpoint
      return installation.target_type === 'Organization';
    });

    return NextResponse.json({ 
      installations: userInstallations,
      user_id: user.id,
      user_login: user.login 
    });
  } catch (error) {
    console.error('[GITHUB INSTALLATIONS ERROR]', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}