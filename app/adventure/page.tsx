'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Script from 'next/script';
import type { HouseSpec } from '../../lib/house';
import './adventure.css';

type AdventureState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: HouseSpec };

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));
const lerp = (value: number, target: number, amount: number) =>
  value + (target - value) * amount;

const discoveryTargets = [
  { id: 'x_pos', axis: 'x', value: 70, tolerance: 6, label: 'x +' },
  { id: 'x_neg', axis: 'x', value: -70, tolerance: 6, label: 'x -' },
  { id: 'y_pos', axis: 'y', value: 20, tolerance: 3, label: 'y +' },
  { id: 'y_neg', axis: 'y', value: -20, tolerance: 3, label: 'y -' },
  { id: 'z_pos', axis: 'z', value: 2.7, tolerance: 0.35, label: 'z +' },
  { id: 'z_neg', axis: 'z', value: 0.7, tolerance: 0.35, label: 'z -' },
];

const stage1PersonaMeta = {
  PATH_FOLLOWER: {
    image: '/images/stage1/path-follower.png',
    title: 'Path Follower',
    description: 'Most of your current favorite songs were already favorites before.',
  },
  IN_ROTATION: {
    image: '/images/stage1/in-rotation.png',
    title: 'In Rotation',
    description: 'Some favorites stayed while new ones entered the mix.',
  },
  EXPLORER: {
    image: '/images/stage1/explorer.png',
    title: 'Explorer',
    description: 'Most of your current favorite songs are new to this era.',
  },
} as const;

const stage1ImageMap: Record<string, string> = {
  PATH_FOLLOWER: '/images/stage1/path-follower.png',
  IN_ROTATION: '/images/stage1/in-rotation.png',
  EXPLORER: '/images/stage1/explorer.png',
};

const stage2PersonaMeta: Record<string, { image: string; title: string; description: string }> = {
  NO_ARTIST_TIES: {
    image: '/images/stage2/no-artist-ties.png',
    title: 'No Artist Ties',
    description: 'Your top tracks span many different artists with no single favorite.',
  },
  MIXED_ARTISTS: {
    image: '/images/stage2/mixed-artists.png',
    title: 'Mixed Artists',
    description: 'You listen across a wide range of artists with varied representation.',
  },
  ARTIST_FOCUSED: {
    image: '/images/stage2/artist-focused.png',
    title: 'Artist Focused',
    description: 'A few artists show up often in your current favorites.',
  },
  ONE_ARTIST_OBSESSED: {
    image: '/images/stage2/one-artist-obsessed.png',
    title: 'One Artist Obsessed',
    description: 'One artist dominates your current top tracks.',
  },
};

// Sphere uses same image paths as persona cards (single source of truth)
const stage2TextureMap: Record<string, string> = Object.fromEntries(
  Object.entries(stage2PersonaMeta).map(([k, v]) => [k, v.image])
);

const stage3PersonaMeta: Record<string, { image: string; title: string; description: string }> = {
  MORNING_STARTER: {
    image: '/images/stage3/morning-starter.jpg',
    title: 'Morning Starter',
    description: 'Most of your listening happens in the morning.',
  },
  DAYTIME_DRIFTER: {
    image: '/images/stage3/daytime-drifter.png',
    title: 'Daytime Drifter',
    description: 'You listen most during the afternoon.',
  },
  EVENING_UNWINDER: {
    image: '/images/stage3/evening-unwinder.png',
    title: 'Evening Unwinder',
    description: 'Your peak listening is in the evening.',
  },
  AFTER_HOURS: {
    image: '/images/stage3/after-hours.png',
    title: 'After Hours',
    description: 'You listen most late at night.',
  },
  ALL_DAY_FLOW: {
    image: '/images/stage3/all-day-flow.png',
    title: 'All Day Flow',
    description: 'Your listening is spread evenly across the day.',
  },
  LOCKED_IN: {
    image: '/images/stage3/locked-in.png',
    title: 'Locked In',
    description: 'You were locked in, concentrated on your listening during specific hours.',
  },
};

// Sphere uses same image paths as persona cards (single source of truth)
const stage3TextureMap: Record<string, string> = Object.fromEntries(
  Object.entries(stage3PersonaMeta).map(([k, v]) => [k, v.image])
);

const stage4PersonaMeta: Record<string, { image: string; title: string; description: string }> = {
  STREAMER: {
    image: '/images/stage4/streamer.png',
    title: 'Streamer',
    description: 'You rely on algorithmic playlists more than your own curation.',
  },
  CASUAL_CURATOR: {
    image: '/images/stage4/casual-curator.png',
    title: 'Casual Curator',
    description: 'You maintain a modest collection of playlists.',
  },
  MICRO_CURATOR: {
    image: '/images/stage4/micro-curator.png',
    title: 'Micro Curator',
    description: 'You create many small, focused playlists.',
  },
  ARCHIVIST: {
    image: '/images/stage4/archivist.png',
    title: 'Archivist',
    description: 'You build substantial playlists and keep them organized.',
  },
  POWER_CURATOR: {
    image: '/images/stage4/power-curator.png',
    title: 'Power Curator',
    description: 'You have a large, deeply curated playlist library.',
  },
  WORLD_BUILDER: {
    image: '/images/stage4/world-builder.png',
    title: 'World Builder',
    description: 'One or a few playlists dominate your listening universe.',
  },
};

const stage4TextureMap: Record<string, string> = {
  STREAMER: '/images/stage4/streamer.png',
  CASUAL_CURATOR: '/images/stage4/casual-curator.png',
  MICRO_CURATOR: '/images/stage4/micro-curator.png',
  ARCHIVIST: '/images/stage4/archivist.png',
  POWER_CURATOR: '/images/stage4/power-curator.png',
  WORLD_BUILDER: '/images/stage4/world-builder.png',
};

export default function AdventurePage() {
  const [demo, setDemo] = useState(false);
  const [preset, setPreset] = useState('calm');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setDemo(params.get('demo') === '1');
    const presetParam = params.get('preset');
    if (presetParam) {
      setPreset(presetParam);
    }
  }, []);

  const endpoint = useMemo(() => {
    if (demo) {
      const params = new URLSearchParams({ demo: '1', preset });
      return `/api/house?${params.toString()}`;
    }
    return '/api/house';
  }, [demo, preset]);

  const [state, setState] = useState<AdventureState>({ status: 'idle' });
  const [p5Ready, setP5Ready] = useState(false);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const sketchRef = useRef<any>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const handRef = useRef({ rotX: -8, rotY: 20, zoom: 1.2 });
  const lastPoseRef = useRef({ rotX: -8, rotY: 20, zoom: 1.2 });
  const idleRef = useRef({ rotX: -8, rotY: 20, lastTime: 0 });
  const lastHudUpdateRef = useRef(0);
  const lastPoseForSpeedRef = useRef({ rotX: -8, rotY: 20, zoom: 1.2 });
  const discoveryRef = useRef<{
    hits: Set<string>;
    completed: boolean;
    maxX: number;
    minX: number;
    maxY: number;
    minY: number;
    maxZ: number;
    minZ: number;
  }>({
    hits: new Set(),
    completed: false,
    maxX: -Infinity,
    minX: Infinity,
    maxY: -Infinity,
    minY: Infinity,
    maxZ: -Infinity,
    minZ: Infinity,
  });
  const questTypeRef = useRef<'routine' | 'discovery' | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastSoundRef = useRef(0);
  const movingRef = useRef(false);
  const lastSpeedRef = useRef(0);
  const soundPlayingRef = useRef(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const lastCaptureRef = useRef(0);
  const pinchActiveRef = useRef(false);
  const [questType, setQuestType] = useState<'routine' | 'discovery' | null>(null);
  const [stage1Label, setStage1Label] = useState<
    'PATH_FOLLOWER' | 'IN_ROTATION' | 'EXPLORER' | null
  >(null);
  const [stage2Label, setStage2Label] = useState<
    'NO_ARTIST_TIES' | 'MIXED_ARTISTS' | 'ARTIST_FOCUSED' | 'ONE_ARTIST_OBSESSED' | null
  >(null);
  const [stage3Label, setStage3Label] = useState<
    | 'MORNING_STARTER'
    | 'DAYTIME_DRIFTER'
    | 'EVENING_UNWINDER'
    | 'AFTER_HOURS'
    | 'ALL_DAY_FLOW'
    | 'LOCKED_IN'
    | null
  >(null);
  const [commitmentLabel, setCommitmentLabel] = useState<
    'MICRO_CURATOR' | 'WORLD_BUILDER' | 'ARCHIVIST' | 'CASUAL_CURATOR' | 'POWER_CURATOR' | 'STREAMER' | null
  >(null);
  const [stageIntensities, setStageIntensities] = useState<[number, number, number, number]>([
    0.25, 0.25, 0.25, 0.25,
  ]);
  const [selectedStageFilter, setSelectedStageFilter] = useState<1 | 2 | 3 | 4 | null>(null);
  const selectedStageFilterRef = useRef<1 | 2 | 3 | 4 | null>(null);
  const [stage1Detail, setStage1Detail] = useState<{
    favoritesInRotation: { trackName: string; artistName: string }[];
  } | null>(null);
  const [stage2Detail, setStage2Detail] = useState<{
    topArtists: { name: string; share: number }[];
  } | null>(null);
  const [stage3Detail, setStage3Detail] = useState<{ peakWindow?: string } | null>(null);
  const [stage4Detail, setStage4Detail] = useState<{
    examplePlaylists: { name: string; trackCount: number }[];
  } | null>(null);
  const [discoveryHits, setDiscoveryHits] = useState<string[]>([]);
  const [discoveryDone, setDiscoveryDone] = useState(false);
  const [snapshots, setSnapshots] = useState<string[]>([]);
  const [cameraReady, setCameraReady] = useState(false);
  const [hud, setHud] = useState({
    rotX: -8,
    rotY: 20,
    zoom: 1.2,
    speed: 0,
  });

  const captureSquareSnapshot = () => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const size = Math.min(canvas.width, canvas.height);
    const sx = Math.floor((canvas.width - size) / 2);
    const sy = Math.floor((canvas.height - size) / 2);
    const snapshot = document.createElement('canvas');
    snapshot.width = size;
    snapshot.height = size;
    const ctx = snapshot.getContext('2d');
    if (!ctx) {
      return;
    }
    ctx.drawImage(canvas, sx, sy, size, size, 0, 0, size, size);
    const dataUrl = snapshot.toDataURL('image/png');
    setSnapshots([dataUrl]);
  };

  useEffect(() => {
    let active = true;
    setState({ status: 'loading' });
    fetch(endpoint)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || 'Unable to load adventure data.');
        }
        return res.json();
      })
      .then((data: HouseSpec) => {
        if (active) {
          setState({ status: 'ready', data });
        }
      })
      .catch((error: Error) => {
        if (active) {
          setState({ status: 'error', message: error.message });
        }
      });

    return () => {
      active = false;
    };
  }, [endpoint]);

  useEffect(() => {
    let active = true;
    fetch('/api/stages')
      .then(async (res) => {
        if (!res.ok) {
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (!active || !data) {
          return;
        }

        // Stage 1: Routine vs Discovery persona (PATH_FOLLOWER / IN_ROTATION / EXPLORER)
        const routineLabel = data.stage1?.label as
          | 'PATH_FOLLOWER'
          | 'IN_ROTATION'
          | 'EXPLORER'
          | null
          | undefined;
        const familiarity = data.stage1?.familiarity_score as number | undefined;

        if (routineLabel === 'EXPLORER') {
          setQuestType('discovery');
        } else if (routineLabel === 'PATH_FOLLOWER' || routineLabel === 'IN_ROTATION') {
          setQuestType('routine');
        } else if (typeof familiarity === 'number') {
          // Fallback: infer routine vs discovery from numeric familiarity_score
          setQuestType(familiarity >= 0.55 ? 'routine' : 'discovery');
        }

        if (
          routineLabel === 'PATH_FOLLOWER' ||
          routineLabel === 'IN_ROTATION' ||
          routineLabel === 'EXPLORER'
        ) {
          setStage1Label(routineLabel);
        } else {
          setStage1Label(null);
        }

        // Stage 2: artist identity persona
        const s2 = data.stage2?.label as
          | 'NO_ARTIST_TIES'
          | 'MIXED_ARTISTS'
          | 'ARTIST_FOCUSED'
          | 'ONE_ARTIST_OBSESSED'
          | null
          | undefined;
        if (
          s2 === 'NO_ARTIST_TIES' ||
          s2 === 'MIXED_ARTISTS' ||
          s2 === 'ARTIST_FOCUSED' ||
          s2 === 'ONE_ARTIST_OBSESSED'
        ) {
          setStage2Label(s2);
        } else {
          setStage2Label(null);
        }

        // Stage 3: listening rhythm persona
        const s3 = data.stage3?.label as
          | 'MORNING_STARTER'
          | 'DAYTIME_DRIFTER'
          | 'EVENING_UNWINDER'
          | 'AFTER_HOURS'
          | 'ALL_DAY_FLOW'
          | 'LOCKED_IN'
          | null
          | undefined;
        if (
          s3 === 'MORNING_STARTER' ||
          s3 === 'DAYTIME_DRIFTER' ||
          s3 === 'EVENING_UNWINDER' ||
          s3 === 'AFTER_HOURS' ||
          s3 === 'ALL_DAY_FLOW' ||
          s3 === 'LOCKED_IN'
        ) {
          setStage3Label(s3);
        } else {
          setStage3Label(null);
        }

        // Stage 4: playlist curation persona (soft-scoring labels)
        const label = data.stage4?.label as
          | 'MICRO_CURATOR'
          | 'WORLD_BUILDER'
          | 'ARCHIVIST'
          | 'CASUAL_CURATOR'
          | 'POWER_CURATOR'
          | 'STREAMER'
          | null
          | undefined;
        if (
          label === 'MICRO_CURATOR' ||
          label === 'WORLD_BUILDER' ||
          label === 'ARCHIVIST' ||
          label === 'CASUAL_CURATOR' ||
          label === 'POWER_CURATOR' ||
          label === 'STREAMER'
        ) {
          setQuestType((prev) => prev); // no-op; keep existing questType
          setCommitmentLabel(label);
        }

        // Intensities for sphere population (0–1 per stage)
        const i1 =
          typeof data.stage1?.familiarity_score === 'number'
            ? Math.min(1, Math.max(0, data.stage1.familiarity_score))
            : 0.5;
        const topArtist = data.stage2?.topArtists?.[0];
        const i2 =
          topArtist && typeof topArtist.share === 'number'
            ? Math.min(1, Math.max(0, topArtist.share * 2))
            : 0.5;
        const peakShare = data.stage3?.rhythm?.peakHourShare;
        const i3 =
          typeof peakShare === 'number' ? Math.min(1, Math.max(0, peakShare * 1.5)) : 0.5;
        const cur = data.stage4?.stats;
        const i4 =
          cur && typeof cur.curatedRatio === 'number'
            ? Math.min(1, Math.max(0, cur.curatedRatio))
            : 0.5;
        setStageIntensities([i1, i2, i3, i4]);

        setStage1Detail({
          favoritesInRotation: data.stage1?.favoritesInRotation ?? [],
        });
        setStage2Detail({
          topArtists: data.stage2?.topArtists ?? [],
        });
        setStage3Detail({
          peakWindow: data.stage3?.rhythm?.peakWindow,
        });
        setStage4Detail({
          examplePlaylists: data.stage4?.examplePlaylists ?? [],
        });
      })
      .catch(() => {
        // leave questType/persona unset if stages fails
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    questTypeRef.current = questType;
  }, [questType]);

  useEffect(() => {
    selectedStageFilterRef.current = selectedStageFilter;
  }, [selectedStageFilter]);

  useEffect(() => {
    document.body.classList.add('adventure-view');
    return () => {
      document.body.classList.remove('adventure-view');
    };
  }, []);

  useEffect(() => {
    const body = document.body;
    const exploreClass = 'adventure-explore';
    const isExplore = (questType ?? 'discovery') === 'discovery';

    if (isExplore) {
      body.classList.add(exploreClass);
    } else {
      body.classList.remove(exploreClass);
    }

    return () => {
      body.classList.remove(exploreClass);
    };
  }, [questType]);

  useEffect(() => {
    const audio = new Audio('/sound/glass_1.wav');
    audio.volume = 0.6;
    audio.addEventListener('ended', () => {
      soundPlayingRef.current = false;
    });
    audio.addEventListener('pause', () => {
      soundPlayingRef.current = false;
    });
    audioRef.current = audio;
    return () => {
      audio.pause();
      audioRef.current = null;
    };
  }, []);

  useEffect(() => {
    let running = true;
    let stream: MediaStream | null = null;
    let handLandmarker: any = null;
    let lastHandSeen = 0;

    const startHandTracking = async () => {
      if (!videoRef.current) {
        return;
      }
      const vision = await import('@mediapipe/tasks-vision');
      const { FilesetResolver, HandLandmarker } = vision;
      const fileset = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
      );

      handLandmarker = await HandLandmarker.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath:
            'https://storage.googleapis.com/mediapipe-assets/hand_landmarker.task',
        },
        numHands: 2,
        runningMode: 'VIDEO',
      });

      stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 },
      });

      if (!videoRef.current) {
        return;
      }
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setCameraReady(true);

      const processFrame = async () => {
        if (!running || !videoRef.current || !handLandmarker) {
          return;
        }
        const now = performance.now();
        if (videoRef.current.readyState < 2) {
          requestAnimationFrame(processFrame);
          return;
        }

        const result = handLandmarker.detectForVideo(videoRef.current, now);
        const primaryHand = result?.landmarks?.[0];
        const pinchHand = result?.landmarks?.[1];
        const previous = handRef.current;

        let targetRotX = handRef.current.rotX;
        let targetRotY = handRef.current.rotY;
        let targetZoom = handRef.current.zoom;

        let handVisible = false;
        if (primaryHand && primaryHand.length > 0) {
          handVisible = true;
          lastHandSeen = now;
          const wrist = primaryHand[0];
          const thumbTip = primaryHand[4];
          const indexTip = primaryHand[8];
          const indexMcp = primaryHand[5];
          const pinkyMcp = primaryHand[17];
          const pinchDistance = Math.hypot(
            indexTip.x - thumbTip.x,
            indexTip.y - thumbTip.y
          );

          const pinchAmount = clamp(1 - pinchDistance / 0.12, 0, 1);
          const spreadAmount = clamp(pinchDistance / 0.35, 0, 1);

          targetZoom = clamp(
            0.8 + spreadAmount * 2.0 - pinchAmount * 0.3,
            0.6,
            3.2
          );

          const twistAngle = Math.atan2(
            indexMcp.y - pinkyMcp.y,
            indexMcp.x - pinkyMcp.x
          );
          targetRotY = (twistAngle * 120) / Math.PI;
          targetRotX = clamp((0.5 - wrist.y) * 80, -28, 28);
          lastPoseRef.current = {
            rotX: targetRotX,
            rotY: targetRotY,
            zoom: targetZoom,
          };

        }

        if (pinchHand && pinchHand.length > 0) {
          const pinchThumb = pinchHand[4];
          const pinchIndex = pinchHand[8];
          const pinchDistance = Math.hypot(
            pinchIndex.x - pinchThumb.x,
            pinchIndex.y - pinchThumb.y
          );
          const pinchAmount = clamp(1 - pinchDistance / 0.12, 0, 1);
          const nowMs = performance.now();
          const pinchStart = pinchAmount > 0.8 && !pinchActiveRef.current;
          const pinchEnd = pinchAmount < 0.4 && pinchActiveRef.current;
          if (pinchStart) {
            pinchActiveRef.current = true;
            if (nowMs - lastCaptureRef.current > 900) {
              lastCaptureRef.current = nowMs;
              captureSquareSnapshot();
            }
          } else if (pinchEnd) {
            pinchActiveRef.current = false;
          }
        } else if (pinchActiveRef.current) {
          pinchActiveRef.current = false;
        }

        if (!handVisible && now - lastHandSeen > 200) {
          const lastPose = lastPoseRef.current;
          const idle = idleRef.current;
          const delta = idle.lastTime ? (now - idle.lastTime) / 1000 : 0;
          idle.lastTime = now;
          idle.rotY += delta * 8;
          idle.rotX = clamp(idle.rotX + delta * 3, -25, 25);
          targetRotX = idle.rotX;
          targetRotY = idle.rotY;
          targetZoom = lastPose.zoom;
        } else if (handVisible) {
          idleRef.current.lastTime = now;
          idleRef.current.rotY = targetRotY;
          idleRef.current.rotX = targetRotX;
        }

        handRef.current = {
          rotX: lerp(previous.rotX, targetRotX, handVisible ? 0.1 : 0.04),
          rotY: lerp(previous.rotY, targetRotY, handVisible ? 0.1 : 0.04),
          zoom: lerp(previous.zoom, targetZoom, handVisible ? 0.1 : 0.04),
        };

        const speedBase = lastPoseForSpeedRef.current;
        const speedDelta = Math.max((now - lastHudUpdateRef.current) / 1000, 0.016);
        const currentPose = handRef.current;
        const dz = (currentPose.zoom - speedBase.zoom) * 60;
        const speed = Math.sqrt(
          Math.pow(currentPose.rotX - speedBase.rotX, 2) +
            Math.pow(currentPose.rotY - speedBase.rotY, 2) +
            dz * dz
        ) / speedDelta;
        lastPoseForSpeedRef.current = {
          rotX: currentPose.rotX,
          rotY: currentPose.rotY,
          zoom: currentPose.zoom,
        };

        const prevSpeed = lastSpeedRef.current;
        lastSpeedRef.current = speed;
        const speedSpike = speed > 150 && prevSpeed <= 150;
        const moveEnd = speed < 6 && movingRef.current;
        if (speedSpike) {
          movingRef.current = true;
          const audio = audioRef.current;
          const sinceLast = now - lastSoundRef.current;
          if (audio && sinceLast > 400 && !soundPlayingRef.current) {
            lastSoundRef.current = now;
            audio.currentTime = 0;
            soundPlayingRef.current = true;
            audio.play().catch(() => {
              // ignore autoplay restrictions
              soundPlayingRef.current = false;
            });
          }
        } else if (moveEnd) {
          movingRef.current = false;
        }

        const activeQuestType = questTypeRef.current ?? 'discovery';

        if (activeQuestType === 'discovery' && !discoveryRef.current.completed) {
          const discovery = discoveryRef.current;
          const hits = discovery.hits;
          const currentX = -handRef.current.rotY;
          const currentY = -handRef.current.rotX;
          const currentZ = handRef.current.zoom;

          discovery.maxX = Math.max(discovery.maxX, currentX);
          discovery.minX = Math.min(discovery.minX, currentX);
          discovery.maxY = Math.max(discovery.maxY, currentY);
          discovery.minY = Math.min(discovery.minY, currentY);
          discovery.maxZ = Math.max(discovery.maxZ, currentZ);
          discovery.minZ = Math.min(discovery.minZ, currentZ);

          discoveryTargets.forEach((target) => {
            if (hits.has(target.id)) {
              return;
            }
            const targetIsPositive = target.value >= 0;
            let hit = false;
            if (target.axis === 'x') {
              hit = targetIsPositive
                ? discovery.maxX >= target.value - target.tolerance
                : discovery.minX <= target.value + target.tolerance;
            } else if (target.axis === 'y') {
              hit = targetIsPositive
                ? discovery.maxY >= target.value - target.tolerance
                : discovery.minY <= target.value + target.tolerance;
            } else {
              hit = targetIsPositive
                ? discovery.maxZ >= target.value - target.tolerance
                : discovery.minZ <= target.value + target.tolerance;
            }
            if (hit) {
              hits.add(target.id);
            }
          });
          if (hits.size === discoveryTargets.length) {
            discovery.completed = true;
          }
        }

        if (now - lastHudUpdateRef.current > 120) {
          lastHudUpdateRef.current = now;
          setHud({
            rotX: handRef.current.rotX,
            rotY: handRef.current.rotY,
            zoom: handRef.current.zoom,
            speed,
          });
          if (activeQuestType === 'discovery') {
            setDiscoveryHits(Array.from(discoveryRef.current.hits));
            setDiscoveryDone(discoveryRef.current.completed);
          }
        }

        requestAnimationFrame(processFrame);
      };

      requestAnimationFrame(processFrame);
    };

    startHandTracking().catch(() => {
      running = false;
      setCameraReady(false);
    });

    return () => {
      running = false;
      setCameraReady(false);
      if (handLandmarker?.close) {
        handLandmarker.close();
      }
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const worldStyle = useMemo(() => {
    if (state.status !== 'ready') {
      return {};
    }
    const spec = state.data;
    const scale = 0.9 + spec.diversity * 0.3;
    const hue = Math.round(210 - spec.valence * 180);
    const glow = 0.2 + spec.energy * 0.6;

    return {
      '--world-scale': scale.toFixed(2),
      '--world-hue': `${hue}`,
      '--world-glow': glow.toFixed(2),
    } as React.CSSProperties;
  }, [state]);

  useEffect(() => {
    if (!p5Ready || state.status !== 'ready' || !stageRef.current) {
      return;
    }

    let cancelled = false;

    const init = async () => {
      const P5Constructor = (window as any).p5;
      if (!P5Constructor) {
        return;
      }
      if (cancelled || !stageRef.current) {
        return;
      }

      if (sketchRef.current) {
        sketchRef.current.remove();
        sketchRef.current = null;
      }

      const TOTAL_SPHERE_POINTS = 140;
      const MIN_POINTS_PER_STAGE = 12;

      const sketch = (p: any) => {
        let stage1Image: any = null;
        let stage2Texture: any = null;
        let stage3Texture: any = null;
        let stage4Texture: any = null;
        const spherePoints: Array<{
          x: number;
          y: number;
          z: number;
          size: number;
          shape: 'plane' | 'box' | 'sphere';
          textureKey: 'stage1' | 'stage2' | 'stage3' | 'stage4';
          phase: number;
          spin: number;
        }> = [];

        p.preload = () => {
          if (stage1Label && stage1ImageMap[stage1Label]) {
            stage1Image = p.loadImage(stage1ImageMap[stage1Label]);
          }
          if (stage2Label && stage2TextureMap[stage2Label]) {
            stage2Texture = p.loadImage(stage2TextureMap[stage2Label]);
          }
          if (stage3Label && stage3TextureMap[stage3Label]) {
            stage3Texture = p.loadImage(stage3TextureMap[stage3Label]);
          }
          if (commitmentLabel && stage4TextureMap[commitmentLabel]) {
            stage4Texture = p.loadImage(stage4TextureMap[commitmentLabel]);
          }
        };

        p.setup = () => {
          const { clientWidth, clientHeight } = stageRef.current!;
          p.createCanvas(clientWidth, clientHeight, p.WEBGL);
          p.angleMode(p.DEGREES);
          p.noStroke();
          p.textureMode(p.NORMAL);
          canvasRef.current = p.canvas;

          const gl = p._renderer?.GL;
          if (gl) {
            gl.enable(gl.BLEND);
            gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
            gl.clearColor(0, 0, 0, 0);
          }

          // Build sphere point distribution from stage intensities (only stages with labels)
          const hasStage = [!!stage1Label, !!stage2Label, !!stage3Label, !!commitmentLabel];
          const activeCount = hasStage.filter(Boolean).length;
          if (activeCount === 0) {
            return;
          }
          const sumIntensity = stageIntensities.reduce(
            (sum, val, i) => sum + (hasStage[i] ? val : 0),
            0
          );
          const reserved = MIN_POINTS_PER_STAGE * activeCount;
          const toDistribute = Math.max(0, TOTAL_SPHERE_POINTS - reserved);
          const counts: number[] = [0, 0, 0, 0];
          for (let i = 0; i < 4; i++) {
            if (!hasStage[i]) continue;
            const share = sumIntensity > 0 ? stageIntensities[i] / sumIntensity : 1 / activeCount;
            counts[i] = MIN_POINTS_PER_STAGE + Math.round(toDistribute * share);
          }
          let total = counts.reduce((a, b) => a + b, 0);
          const diff = TOTAL_SPHERE_POINTS - total;
          if (diff !== 0) {
            const firstActive = hasStage.findIndex(Boolean);
            if (firstActive >= 0) counts[firstActive] = Math.max(MIN_POINTS_PER_STAGE, counts[firstActive] + diff);
          }

          const stageKeys: ('stage1' | 'stage2' | 'stage3' | 'stage4')[] = [
            'stage1',
            'stage2',
            'stage3',
            'stage4',
          ];
          const assign: ('stage1' | 'stage2' | 'stage3' | 'stage4')[] = [];
          for (let s = 0; s < 4; s++) {
            for (let k = 0; k < counts[s]; k++) {
              assign.push(stageKeys[s]);
            }
          }
          // Shuffle so personas are scattered throughout the sphere, not clustered
          for (let i = assign.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [assign[i], assign[j]] = [assign[j], assign[i]];
          }
          const radius = 230;
          const shapes: Array<'plane' | 'box' | 'sphere'> = ['plane', 'box', 'sphere'];
          for (let i = 0; i < TOTAL_SPHERE_POINTS && i < assign.length; i++) {
            const t = i / (TOTAL_SPHERE_POINTS - 1 || 1);
            const inclination = Math.acos(1 - 2 * t);
            const azimuth = 180 * (3 - Math.sqrt(5)) * i;
            const x = radius * Math.sin(inclination) * Math.cos(azimuth);
            const y = radius * Math.sin(inclination) * Math.sin(azimuth);
            const z = radius * Math.cos(inclination);
            const size = 20 + (i % 6) * 6;
            const shape = shapes[i % 3];
            const phase = (i % 12) * 0.45;
            const spin = (i % 7) * 0.6 + 0.4;
            spherePoints.push({
              x,
              y,
              z,
              size,
              shape,
              textureKey: assign[i],
              phase,
              spin,
            });
          }
        };

        p.windowResized = () => {
          if (!stageRef.current) {
            return;
          }
          p.resizeCanvas(stageRef.current.clientWidth, stageRef.current.clientHeight);
        };

        p.draw = () => {
          const gl = p._renderer?.GL;
          if (gl) {
            gl.clearColor(0, 0, 0, 0);
            gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
          } else {
            p.clear();
          }
          const handState = handRef.current;
          p.rotateX(handState.rotX);
          p.rotateY(handState.rotY);
          p.scale(handState.zoom);
          p.ambientLight(180);
          p.directionalLight(255, 255, 255, 0.2, 0.5, -1);

          const t = p.millis() * 0.001;
          const zoomInFactor = p.constrain((handState.zoom - 1.0) / 0.8, 0, 1);
          const motion = p.constrain(lastSpeedRef.current / 80, 0, 1);
          const lineAlphaBase = Math.max(0.12, zoomInFactor, motion * 0.55);
          const filter = selectedStageFilterRef.current;
          const dimOpacity = 0.32;
          const isFiltered = filter !== null;

          // Sphere populated with the 4 persona images (intensity-weighted)
          spherePoints.forEach((point) => {
            const texture =
              point.textureKey === 'stage1'
                ? stage1Image
                : point.textureKey === 'stage2'
                  ? stage2Texture
                  : point.textureKey === 'stage3'
                    ? stage3Texture
                    : stage4Texture;
            if (!texture) return;
            const isStage4Point = point.textureKey === 'stage4';
            const shimmer = (Math.sin(t * 1.6 + point.phase) + 1) * 0.5;
            const fade = (Math.sin(t * 0.8 + point.phase * 0.6) + 1) * 0.5;
            let alpha = 72 + fade * 235;
            if (isStage4Point) {
              alpha *= 0.8;
            }
            if (isFiltered && point.textureKey !== `stage${filter}`) {
              alpha *= dimOpacity;
            }
            const scale = 0.85 + shimmer * 0.25;
            p.push();
            p.translate(point.x, point.y, point.z);
            p.rotateZ(t * point.spin * 12);
            p.rotateY(t * point.spin * 8);
            p.scale(scale);
            p.noLights();
            if (isStage4Point) {
              p.tint(235, 220, 200, alpha);
              p.blendMode(p.BLEND);
            } else {
              p.tint(255, alpha);
              p.blendMode(p.SCREEN);
            }
            p.texture(texture);
            if (point.shape === 'plane') {
              const gl = p._renderer?.GL;
              if (gl) gl.disable(gl.DEPTH_TEST);
              p.plane(point.size * 1.4, point.size * 1.4);
              if (gl) gl.enable(gl.DEPTH_TEST);
            } else if (point.shape === 'sphere') {
              p.sphere(point.size * 0.5, 12, 10);
            } else {
              p.box(point.size, point.size * 0.6, point.size * 0.6);
            }
            p.blendMode(p.BLEND);
            p.pop();
          });

          // Lines: Stage 1 from middle + to each other; Stages 2–4 connect within group
          const lineColors: Record<string, [number, number, number]> = {
            stage1: [210, 190, 255],
            stage2: [150, 200, 255],
            stage3: [160, 240, 210],
            stage4: [255, 205, 170],
          };
          const personaGroups: Record<
            string,
            Array<{ x: number; y: number; z: number; textureKey: string }>
          > = {};
          spherePoints.forEach((point) => {
            const key = point.textureKey;
            if (!personaGroups[key]) personaGroups[key] = [];
            personaGroups[key].push({
              x: point.x,
              y: point.y,
              z: point.z,
              textureKey: point.textureKey,
            });
          });
          Object.entries(personaGroups).forEach(([key, group]) => {
            if (group.length < 1) return;
            const [r, g, bl] = lineColors[key] ?? [190, 210, 255];
            const lineDim = isFiltered && key !== `stage${filter}` ? dimOpacity : 1;
            group.forEach((point, i) => {
              let alpha = lineAlphaBase * 0.5 * lineDim;
              if (alpha <= 0.04) return;
              const wave = Math.sin(t * 1.1 + i * 0.5) * 0.25 + 0.75;
              p.push();
              p.strokeWeight(0.8);
              p.stroke(r * wave, g * wave, bl, 255 * alpha);
              p.noFill();
              if (key === 'stage1') {
                p.line(0, 0, 0, point.x, point.y, point.z);
              }
              p.pop();
            });
            if (group.length >= 2 && key !== 'stage1') {
              for (let i = 0; i < group.length; i += 1) {
                const a = group[i];
                const b = group[(i + 1) % group.length];
                let alpha = lineAlphaBase * 0.5 * lineDim;
                if (alpha <= 0.04) continue;
                const wave = Math.sin(t * 1.1 + i * 0.5) * 0.25 + 0.75;
                p.push();
                p.strokeWeight(0.8);
                p.stroke(r * wave, g * wave, bl, 255 * alpha);
                p.noFill();
                p.line(a.x, a.y, a.z, b.x, b.y, b.z);
                p.pop();
              }
            }
            if (key === 'stage1' && group.length >= 2) {
              for (let i = 0; i < group.length; i += 1) {
                const a = group[i];
                const b = group[(i + 1) % group.length];
                let alpha = lineAlphaBase * 0.5 * lineDim;
                if (alpha <= 0.04) continue;
                const wave = Math.sin(t * 1.1 + i * 0.5) * 0.25 + 0.75;
                p.push();
                p.strokeWeight(0.8);
                p.stroke(r * wave, g * wave, bl, 255 * alpha);
                p.noFill();
                p.line(a.x, a.y, a.z, b.x, b.y, b.z);
                p.pop();
              }
            }
          });

          // Stage persona visuals (only from stage data); dim when filter active
          const renderPersonaVisuals = () => {
            const visDim = (stage: number) => {
              if (!isFiltered) return 255;
              return filter === stage ? 255 : Math.round(255 * dimOpacity);
            };
            // Stage 1: floating 2D image (left/front) - plane showing image as artwork
            if (stage1Image) {
              p.push();
              p.translate(-180, 0, 100);
              p.rotateY(90);
              p.noLights();
              p.tint(255, visDim(1));
              p.texture(stage1Image);
              p.plane(90, 90);
              p.pop();
              p.ambientLight(180);
              p.directionalLight(255, 255, 255, 0.2, 0.5, -1);
            }
            // Stage 2: rectangular box with texture (right)
            if (stage2Texture) {
              p.push();
              p.translate(180, 0, 80);
              p.rotateY(t * 8);
              p.tint(255, visDim(2));
              p.texture(stage2Texture);
              p.box(70, 70, 50);
              p.pop();
            }
            // Stage 3: vertical plane/card with texture (upper/back)
            if (stage3Texture) {
              p.push();
              p.translate(0, -120, 200);
              p.rotateX(10);
              p.rotateY(t * 5);
              p.tint(255, visDim(3));
              p.texture(stage3Texture);
              p.plane(100, 100);
              p.pop();
            }
            // Stage 4: larger architectural box (lower/front)
            if (stage4Texture) {
              p.push();
              p.translate(0, 120, 50);
              p.rotateY(t * 6);
              p.tint(235, 220, 200, Math.round(visDim(4) * 0.92));
              p.texture(stage4Texture);
              p.box(120, 100, 80);
              p.pop();
            }
          };
          renderPersonaVisuals();

          // x y z coordinates axis lines (screen overlay)
          const xCoord = -handState.rotY;
          const yCoord = -handState.rotX;
          const zCoord = handState.zoom;
          const overlayAlpha = 1;
          {
            const gl = (p as any)._renderer?.GL;
            p.push();
            if (gl) gl.disable(gl.DEPTH_TEST);
            p.resetMatrix();
            p.translate(-p.width / 2, -p.height / 2);
            const centerX = p.width / 2;
            const baseY = p.height - 96;
            const lineLength = 200;
            const xNorm = p.constrain(xCoord / 90, -1, 1);
            const yNorm = p.constrain(yCoord / 45, -1, 1);
            const zNorm = p.constrain((zCoord - 0.6) / (3.2 - 0.6), 0, 1);
            const tickWave = (Math.sin(t * 1.4) + 1) * 0.5;
            const iridescentR = 190 + 40 * tickWave;
            const iridescentG = 210 + 25 * (1 - tickWave);
            const iridescentB = 255;
            p.stroke(255, 255, 255, 160 * overlayAlpha);
            p.strokeWeight(3);
            p.line(centerX - lineLength, baseY, centerX + lineLength, baseY);
            p.stroke(iridescentR, iridescentG, iridescentB, 255 * overlayAlpha);
            p.line(centerX, baseY - 18, centerX, baseY + 18);
            p.line(
              centerX + xNorm * lineLength,
              baseY - 28,
              centerX + xNorm * lineLength,
              baseY + 28
            );
            p.line(
              centerX + yNorm * lineLength,
              baseY - 18,
              centerX + yNorm * lineLength,
              baseY + 18
            );
            p.line(centerX, baseY, centerX, baseY - 40 * zNorm);

            if (gl) gl.enable(gl.DEPTH_TEST);
            p.pop();
          }
        };
      };

      sketchRef.current = new P5Constructor(sketch, stageRef.current);
    };

    init();

    return () => {
      cancelled = true;
      if (sketchRef.current) {
        sketchRef.current.remove();
        sketchRef.current = null;
      }
    };
  }, [state, p5Ready, stage1Label, stage2Label, stage3Label, commitmentLabel, stageIntensities]);

  const axisLineLength = 200;
  const axisXNorm = clamp(-hud.rotY / 90, -1, 1);
  const axisYNorm = clamp(-hud.rotX / 45, -1, 1);
  const axisXOffset = axisXNorm * axisLineLength;
  const axisYOffset = axisYNorm * axisLineLength;

  const personaXOffset = axisXOffset * 0.45;
  const personaYOffset = axisYNorm * 40;

  const persona =
    commitmentLabel === 'MICRO_CURATOR'
      ? 'MICRO CURATOR'
      : commitmentLabel === 'WORLD_BUILDER'
        ? 'WORLD BUILDER'
        : commitmentLabel === 'ARCHIVIST'
          ? 'ARCHIVIST'
          : commitmentLabel === 'CASUAL_CURATOR'
            ? 'CASUAL CURATOR'
            : commitmentLabel === 'POWER_CURATOR'
              ? 'POWER CURATOR'
              : commitmentLabel === 'STREAMER'
                ? 'STREAMER'
                : null;

  const stage1Meta =
    stage1Label != null ? stage1PersonaMeta[stage1Label] : undefined;
  const stage2Meta =
    stage2Label != null ? stage2PersonaMeta[stage2Label] : undefined;
  const stage3Meta =
    stage3Label != null ? stage3PersonaMeta[stage3Label] : undefined;
  const stage4Meta =
    commitmentLabel != null ? stage4PersonaMeta[commitmentLabel] : undefined;

  const getPersonaDetail = (stage: 1 | 2 | 3 | 4) => {
    if (stage === 1) {
      return stage1Detail?.favoritesInRotation && stage1Detail.favoritesInRotation.length > 0
        ? stage1Detail.favoritesInRotation
            .map((fav) => `${fav.trackName} by ${fav.artistName}`)
            .join(' · ')
        : 'No recurring favorites found yet.';
    }
    if (stage === 2) {
      return stage2Detail?.topArtists && stage2Detail.topArtists.length > 0
        ? stage2Detail.topArtists
            .slice(0, 3)
            .map((artist) => `${artist.name} (${Math.round(artist.share * 100)}%)`)
            .join(' · ')
        : 'No dominant artist pattern yet.';
    }
    if (stage === 3) {
      return stage3Detail?.peakWindow
        ? stage3Detail.peakWindow
        : 'No peak listening window yet.';
    }
    return stage4Detail && stage4Detail.examplePlaylists.length > 0
      ? stage4Detail.examplePlaylists
          .slice(0, 4)
          .map((pl) => `${pl.name} (${pl.trackCount})`)
          .join(' · ')
      : 'No playlist examples available yet.';
  };

  const personaCards = [
    { meta: stage1Meta, stage: 1 },
    { meta: stage2Meta, stage: 2 },
    { meta: stage3Meta, stage: 3 },
    { meta: stage4Meta, stage: 4 },
  ].filter(({ meta }) => meta != null);

  return (
    <main className="adventure">
      <Script
        src="https://cdn.jsdelivr.net/npm/p5@1.9.0/lib/p5.min.js"
        strategy="afterInteractive"
        onLoad={() => setP5Ready(true)}
      />
      <video
        ref={videoRef}
        muted
        playsInline
        className={`adventure-camera-bg${cameraReady ? ' adventure-camera-bg-visible' : ''}`}
      />
      <header className="adventure-header">
        <p className="eyebrow">Spotify House Adventure</p>
        <h1>Your listening world</h1>
        <p className="subtitle">
          A visual field generated from your Spotify parameters. Tap any object
          to learn why it appears.
        </p>
      </header>

      {personaCards.length > 0 && (
        <section className="adventure-personas" aria-label="Your personas">
          {personaCards.map(({ meta, stage }) => (
            <div key={stage} className="adventure-persona-item">
              <button
                type="button"
                className={`adventure-persona-card${selectedStageFilter === stage ? ' adventure-persona-card-selected' : ''}`}
                aria-pressed={selectedStageFilter === stage}
                aria-label={meta!.title}
                onClick={() => {
                  setSelectedStageFilter((prev) =>
                    prev === stage ? null : (stage as 1 | 2 | 3 | 4)
                  );
                }}
              >
                <img src={meta!.image} alt={meta!.title} />
              </button>
              {selectedStageFilter === stage && (
                <div className="adventure-persona-popup" role="status" aria-live="polite">
                  <h2 className="adventure-persona-popup-title">{meta!.title}</h2>
                  <p className="adventure-persona-popup-description">{meta!.description}</p>
                </div>
              )}
            </div>
          ))}
        </section>
      )}

      {state.status === 'loading' && <p>Loading adventure...</p>}
      {state.status === 'error' && (
        <p className="error">{state.message}</p>
      )}

      {state.status === 'ready' && (
        <section className="p5-world" style={worldStyle}>
          <div className="p5-stage" ref={stageRef} />
        </section>
      )}

      {hud.zoom > 1.9 && !selectedStageFilter && (
        <div
          className="adventure-persona"
          aria-hidden="true"
          style={{
            left: `calc(50% + ${personaXOffset}px)`,
            top: `calc(50% + ${personaYOffset}px)`,
          }}
        >
          {state.status === 'ready' && state.data.userProfile?.displayName
            ? state.data.userProfile.displayName
            : persona ?? 'Your listening world'}
        </div>
      )}

      {selectedStageFilter && hud.zoom > 1.9 && (
        <div
          className="adventure-persona adventure-persona-detail"
          aria-live="polite"
          style={{
            left: `calc(50% + ${personaXOffset}px)`,
            top: `calc(50% + ${personaYOffset}px)`,
          }}
        >
          {getPersonaDetail(selectedStageFilter)}
        </div>
      )}

      <div className="adventure-axis-readout" aria-hidden="true">
        <div className="axis-label-row">
          <span
            className="axis-label"
            style={{ left: `calc(50% + ${axisXOffset}px)` }}
          >
            x
          </span>
          <span
            className="axis-label"
            style={{ left: `calc(50% + ${axisYOffset}px)` }}
          >
            y
          </span>
          <span className="axis-label" style={{ left: '50%' }}>
            z
          </span>
        </div>
        <div className="axis-value-row">
          x {(-hud.rotY).toFixed(1)} · y {(-hud.rotX).toFixed(1)} · z {hud.zoom.toFixed(2)}
        </div>
      </div>

      {snapshots.length > 0 && (
        <aside className="adventure-snapshots">
          {snapshots.map((src, index) => (
            <div key={`${src}-${index}`} className="snapshot-frame">
              <img src={src} alt={`Snapshot ${index + 1}`} />
            </div>
          ))}
        </aside>
      )}
    </main>
  );
}
