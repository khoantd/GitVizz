import { auth } from '@/utils/auth';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const session = await auth();
    
    if (!session) {
      return NextResponse.json(null, { status: 200 });
    }

    // Return the session data in the expected format
    return NextResponse.json({
      user: session.user,
      expires: session.expires,
      jwt_token: session.jwt_token,
      user_id: session.user_id,
      token_type: session.token_type,
      refresh_token: session.refresh_token,
      expires_in: session.expires_in,
    });
  } catch (error) {
    console.error('Session endpoint error:', error);
    return NextResponse.json(null, { status: 200 });
  }
}
