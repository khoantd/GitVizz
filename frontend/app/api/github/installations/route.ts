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

export async function GET(req: NextRequest): Promise<NextResponse> {
  const authHeader = req.headers.get('authorization');
  const accessToken = authHeader?.split(' ')[1];

  if (!accessToken) {
    return NextResponse.json({ error: 'Missing access token' }, { status: 401 });
  }

  const res = await fetch('https://api.github.com/user/installations', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.github+json',
    },
  });

  const data = (await res.json()) as GitHubInstallationResponse | { message: string };

  if (!res.ok) {
    return NextResponse.json(
      { error: (data as { message: string }).message },
      { status: res.status },
    );
  }

  return NextResponse.json({ installations: (data as GitHubInstallationResponse).installations });
}
