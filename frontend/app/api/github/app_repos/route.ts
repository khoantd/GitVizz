// app/api/github/app_repos/route.ts

import { NextRequest } from 'next/server';
import { Octokit } from 'octokit';
import { createAppAuth } from '@octokit/auth-app';
import { auth } from '@/utils/auth';

export async function GET(req: NextRequest): Promise<Response> {
  const { searchParams } = new URL(req.url);
  const installationId = searchParams.get('installationId');

  if (!installationId) {
    return new Response(JSON.stringify({ error: 'Missing installationId' }), {
      status: 400,
    });
  }

  // Check authentication and get user session
  const session = await auth();
  if (!session?.accessToken) {
    return new Response(JSON.stringify({ error: 'Unauthorized - missing session or access token' }), {
      status: 401,
    });
  }

  try {
    // Create GitHub App authentication for installation access
    const appAuth = createAppAuth({
      appId: process.env.GITHUB_APP_ID!,
      privateKey: process.env.GITHUB_PRIVATE_KEY!.replace(/\\n/g, '\n'),
      clientId: process.env.AUTH_GITHUB_ID!,
      clientSecret: process.env.AUTH_GITHUB_SECRET!,
    });

    const installationAuth = await appAuth({
      type: 'installation',
      installationId: Number(installationId),
    });

    // Create Octokit instances - one for installation, one for user
    const installationOctokit = new Octokit({ auth: installationAuth.token });
    const userOctokit = new Octokit({ auth: session.accessToken });

    console.log(`[DEBUG] Installation ID: ${installationId}`);

    // Fetch installation repositories (all repositories accessible to the GitHub App)
    const installationRepositories = [];
    for await (const response of installationOctokit.paginate.iterator(
      installationOctokit.rest.apps.listReposAccessibleToInstallation,
      { per_page: 500 },
    )) {
      console.log(`[DEBUG] Fetched ${response.data.length} installation repositories in this page`);
      installationRepositories.push(...response.data);
    }

    // Fetch user repositories (repositories the authenticated user has access to)
    const userRepositories = [];
    for await (const response of userOctokit.paginate.iterator(
      userOctokit.rest.repos.listForAuthenticatedUser,
      { per_page: 500 },
    )) {
      console.log(`[DEBUG] Fetched ${response.data.length} user repositories in this page`);
      userRepositories.push(...response.data);
    }

    console.log(`[DEBUG] Total installation repositories: ${installationRepositories.length}`);
    console.log(`[DEBUG] Total user repositories: ${userRepositories.length}`);

    // Filter repositories: only return installation repositories that the user has access to
    // Create a Set of user repository IDs for efficient lookup
    const userRepoIds = new Set(userRepositories.map(repo => repo.id));
    
    // Filter installation repositories to only include those the user has access to
    const filteredRepositories = installationRepositories.filter(repo => userRepoIds.has(repo.id));
    
    console.log(`[DEBUG] Filtered repositories (user has access to): ${filteredRepositories.length}`);

    // Sort repositories by updated_at in descending order (most recent first)
    const sortedRepositories = filteredRepositories.sort((a, b) => {
      const dateA = new Date(a.updated_at ?? 0);
      const dateB = new Date(b.updated_at ?? 0);
      return dateB.getTime() - dateA.getTime();
    });

    console.log(`[DEBUG] Repositories sorted by updated_at (descending)`);

    return new Response(
      JSON.stringify({
        repositories: sortedRepositories,
        total_count: sortedRepositories.length,
      }),
      {
        status: 200,
      },
    );
  } catch (error: unknown) {
    console.error('[GITHUB ERROR]', error);

    const message = error instanceof Error ? error.message : 'Internal Server Error';

    return new Response(JSON.stringify({ error: message }), {
      status: 500,
    });
  }
}
