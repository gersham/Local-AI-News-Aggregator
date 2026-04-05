'use client';

import { Mic } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '../../components/ui/button';

export function GeneratePodcastButton() {
  const [generating, setGenerating] = useState(false);
  const router = useRouter();
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  // Poll generation status while generating
  useEffect(() => {
    if (!generating) return;

    async function checkStatus() {
      try {
        const res = await fetch('/api/podcast/generate');
        if (!res.ok) return;
        const data = await res.json();
        if (!data.generating) {
          setGenerating(false);
          router.refresh();
        }
      } catch {
        // retry next interval
      }
    }

    pollRef.current = setInterval(checkStatus, 3000);
    return stopPolling;
  }, [generating, router, stopPolling]);

  // Check on mount whether a generation is already running
  useEffect(() => {
    async function checkInitial() {
      try {
        const res = await fetch('/api/podcast/generate');
        if (!res.ok) return;
        const data = await res.json();
        if (data.generating) setGenerating(true);
      } catch {
        // ignore
      }
    }
    checkInitial();
  }, []);

  async function handleClick() {
    setGenerating(true);

    try {
      const response = await fetch('/api/podcast/generate', { method: 'POST' });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        console.error('Podcast generation failed:', body);
        setGenerating(false);
      }
    } catch (error) {
      console.error('Podcast generation request failed:', error);
      setGenerating(false);
    }
  }

  return (
    <Button onClick={handleClick} disabled={generating}>
      <Mic className={`size-4 ${generating ? 'animate-pulse' : ''}`} />
      {generating ? 'Generating...' : 'Generate Podcast'}
    </Button>
  );
}
