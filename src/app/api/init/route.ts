import { NextResponse } from 'next/server';
import { initializeWatchdogs } from '@/lib/watchdog-engine';

let initialized = false;

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!initialized) {
    try {
      initializeWatchdogs();
      initialized = true;
      return NextResponse.json({ initialized: true, message: 'Watchdogs initialized' });
    } catch (error) {
      console.error('Failed to initialize watchdogs:', error);
      return NextResponse.json({ initialized: false, error: String(error) }, { status: 500 });
    }
  }
  
  return NextResponse.json({ initialized: true, message: 'Already initialized' });
}
