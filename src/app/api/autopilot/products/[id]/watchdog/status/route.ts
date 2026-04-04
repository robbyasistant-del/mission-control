import { NextRequest } from 'next/server';
import { getWatchdogStatus } from '@/lib/watchdog-engine';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const productId = params.id;

  const stream = new ReadableStream({
    start(controller) {
      // Send initial status
      const sendStatus = () => {
        try {
          const status = getWatchdogStatus(productId);
          const data = JSON.stringify({
            is_running: status.isRunning,
            next_run_at: status.nextRunAt?.toISOString() || null,
            interval_seconds: status.intervalSeconds,
            countdown_seconds: status.nextRunAt 
              ? Math.max(0, Math.floor((status.nextRunAt.getTime() - Date.now()) / 1000))
              : 0,
          });
          controller.enqueue(`data: ${data}\n\n`);
        } catch (error) {
          console.error('[SSE] Error sending status:', error);
        }
      };

      // Send initial status
      sendStatus();

      // Send updates every second
      const interval = setInterval(sendStatus, 1000);

      // Clean up on close
      request.signal.addEventListener('abort', () => {
        clearInterval(interval);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
