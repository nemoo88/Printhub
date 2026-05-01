import { useState, useCallback, useEffect, useRef } from 'react';

export interface BedMeshProfile {
  name: string;
  points: number[][];
  mesh_params: {
    min_x: number;
    max_x: number;
    min_y: number;
    max_y: number;
    x_count: number;
    y_count: number;
  };
}

export interface BedMeshData {
  profile: BedMeshProfile | null;
  profiles: string[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

function extractPoints(obj: any): number[][] | null {
  // Try common Klipper field names for mesh point data
  for (const key of ['points', 'mesh_matrix', 'probed_matrix']) {
    const pts = obj?.[key];
    if (Array.isArray(pts) && pts.length > 0 && Array.isArray(pts[0]) && pts[0].length > 0) {
      return pts;
    }
  }
  return null;
}

function extractParams(obj: any, fallback: any): any {
  return obj?.mesh_params ?? obj?.params ?? fallback;
}

export function useBedMesh(printerApiBase: string): BedMeshData {
  const [profile, setProfile] = useState<BedMeshProfile | null>(null);
  const [profiles, setProfiles] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastProfileRef = useRef<BedMeshProfile | null>(null);

  const base = printerApiBase.replace(/\/+$/, '');

  const reload = useCallback(async () => {
    if (!base) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${base}/printer/objects/query?bed_mesh`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const bm = data?.result?.status?.bed_mesh;

      if (!bm) {
        // Keep last known profile if we had one (avoids flash on refresh)
        if (!lastProfileRef.current) setProfile(null);
        return;
      }

      // Collect available profile names
      const profileNames = bm.profiles ? Object.keys(bm.profiles) : [];
      setProfiles(profileNames);

      const meshParams = bm.mesh_params;
      let profileName = bm.profile_name || '';
      let foundProfile: BedMeshProfile | null = null;

      // 1) Try active mesh data (probed_matrix or mesh_matrix)
      const activePoints = extractPoints(bm);
      if (profileName && activePoints) {
        foundProfile = {
          name: profileName,
          points: activePoints,
          mesh_params: {
            min_x: meshParams?.min_x ?? 0,
            max_x: meshParams?.max_x ?? 300,
            min_y: meshParams?.min_y ?? 0,
            max_y: meshParams?.max_y ?? 300,
            x_count: meshParams?.x_count ?? activePoints[0]?.length ?? 1,
            y_count: meshParams?.y_count ?? activePoints.length ?? 1,
          },
        };
      }

      // 2) Fallback: try saved profiles
      if (!foundProfile && bm.profiles) {
        for (const name of profileNames) {
          const saved = bm.profiles[name];
          const pts = extractPoints(saved);
          if (pts) {
            const sp = extractParams(saved, meshParams);
            foundProfile = {
              name,
              points: pts,
              mesh_params: {
                min_x: sp?.min_x ?? 0,
                max_x: sp?.max_x ?? 300,
                min_y: sp?.min_y ?? 0,
                max_y: sp?.max_y ?? 300,
                x_count: sp?.x_count ?? pts[0]?.length ?? 1,
                y_count: sp?.y_count ?? pts.length ?? 1,
              },
            };
            break;
          }
        }
      }

      // 3) If still nothing, keep last known profile
      if (foundProfile) {
        lastProfileRef.current = foundProfile;
        setProfile(foundProfile);
      } else if (lastProfileRef.current) {
        // Don't clear — keep showing the last mesh
        setProfile(lastProfileRef.current);
      } else {
        setProfile(null);
      }
    } catch (e: any) {
      // Silent in production — expected to fail without Moonraker
      if (import.meta.env.DEV) console.warn('BedMesh fetch failed:', e);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [base]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { profile, profiles, loading, error, reload };
}
