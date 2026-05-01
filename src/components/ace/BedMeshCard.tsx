import { useState, useMemo, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { type BedMeshProfile } from '@/hooks/useBedMesh';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Grid3x3, Box, RefreshCw, Loader2 } from 'lucide-react';
import * as THREE from 'three';

interface Props {
  profile: BedMeshProfile | null;
  loading: boolean;
  error: string | null;
  onReload: () => void;
  lang: 'sv' | 'en';
}

// Color scale: blue (low) → green (zero) → red (high)
function valueToColor(value: number, min: number, max: number): string {
  const range = Math.max(max - min, 0.01);
  const normalized = (value - min) / range; // 0..1
  // Blue → Cyan → Green → Yellow → Red
  const h = (1 - normalized) * 240; // 240=blue, 0=red
  return `hsl(${h}, 85%, 50%)`;
}

function valueToThreeColor(value: number, min: number, max: number): THREE.Color {
  const range = Math.max(max - min, 0.01);
  const normalized = (value - min) / range;
  const h = (1 - normalized) * (240 / 360);
  return new THREE.Color().setHSL(h, 0.85, 0.5);
}

// 2D Heatmap
function Heatmap2D({ profile }: { profile: BedMeshProfile }) {
  const { points, mesh_params: mp } = profile;
  const rows = points.length;
  const cols = points[0]?.length || 0;
  const allValues = points.flat();
  const min = Math.min(...allValues);
  const max = Math.max(...allValues);

  return (
    <div className="overflow-auto">
      <div
        className="grid gap-0.5 mx-auto"
        style={{
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          maxWidth: Math.min(cols * 48, 600),
        }}
      >
        {/* Render rows reversed so Y=0 is at the bottom */}
        {[...points].reverse().map((row, ri) =>
          row.map((val, ci) => (
            <div
              key={`${ri}-${ci}`}
              className="aspect-square flex items-center justify-center text-[9px] font-mono font-bold rounded-sm"
              style={{ backgroundColor: valueToColor(val, min, max), color: Math.abs(val) > (max - min) * 0.6 ? '#fff' : '#000' }}
              title={`X${ci} Y${points.length - 1 - ri}: ${val.toFixed(3)}mm`}
            >
              {val.toFixed(2)}
            </div>
          ))
        )}
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground mt-2 px-1">
        <span>Min: {min.toFixed(3)}mm</span>
        <span>Range: {(max - min).toFixed(3)}mm</span>
        <span>Max: {max.toFixed(3)}mm</span>
      </div>
    </div>
  );
}

// 3D Mesh Surface
function MeshSurface({ profile }: { profile: BedMeshProfile }) {
  const geometry = useMemo(() => {
    const { points, mesh_params: mp } = profile;
    const rows = points.length;
    const cols = points[0]?.length || 1;
    const allValues = points.flat();
    const min = Math.min(...allValues);
    const max = Math.max(...allValues);

    const geo = new THREE.BufferGeometry();
    const vertices: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];

    const xRange = mp.max_x - mp.min_x || 1;
    const yRange = mp.max_y - mp.min_y || 1;
    const scale = 4 / Math.max(xRange, yRange); // Normalize to ~4 units
    const zScale = 40; // Exaggerate Z

    for (let yi = 0; yi < rows; yi++) {
      for (let xi = 0; xi < cols; xi++) {
        const x = ((xi / (cols - 1 || 1)) * xRange - xRange / 2) * scale;
        const y = ((yi / (rows - 1 || 1)) * yRange - yRange / 2) * scale;
        const z = points[yi][xi] * zScale * scale;
        vertices.push(x, z, -y);

        const color = valueToThreeColor(points[yi][xi], min, max);
        colors.push(color.r, color.g, color.b);
      }
    }

    for (let yi = 0; yi < rows - 1; yi++) {
      for (let xi = 0; xi < cols - 1; xi++) {
        const a = yi * cols + xi;
        const b = a + 1;
        const c = (yi + 1) * cols + xi;
        const d = c + 1;
        indices.push(a, c, b);
        indices.push(b, c, d);
      }
    }

    geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();

    return geo;
  }, [profile]);

  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial vertexColors side={THREE.DoubleSide} />
    </mesh>
  );
}

function Scene3D({ profile }: { profile: BedMeshProfile }) {
  return (
    <Canvas camera={{ position: [3, 3, 3], fov: 50 }} style={{ height: '100%', minHeight: 280 }}>
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 5, 5]} intensity={0.8} />
      <Suspense fallback={null}>
        <MeshSurface profile={profile} />
        {/* Reference plane at Z=0 */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
          <planeGeometry args={[5, 5]} />
          <meshStandardMaterial color="#333" transparent opacity={0.15} side={THREE.DoubleSide} />
        </mesh>
      </Suspense>
      <OrbitControls enablePan enableZoom enableRotate />
      <gridHelper args={[5, 10, '#555', '#333']} />
    </Canvas>
  );
}

export function BedMeshCard({ profile, loading, error, onReload, lang }: Props) {
  const [mode, setMode] = useState<'3d' | '2d'>('3d');

  if (!profile && !loading && !error) return null;

  return (
    <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
      <CardContent className="pt-3 pb-3 px-4 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {profile && <Badge variant="outline" className="text-[10px]">{profile.name}</Badge>}
          </div>
          <div className="flex items-center gap-1">
            <Button variant={mode === '3d' ? 'secondary' : 'ghost'} size="icon" className="h-6 w-6" onClick={() => setMode('3d')} title="3D">
              <Box className="h-3.5 w-3.5" />
            </Button>
            <Button variant={mode === '2d' ? 'secondary' : 'ghost'} size="icon" className="h-6 w-6" onClick={() => setMode('2d')} title="2D">
              <Grid3x3 className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onReload} disabled={loading}>
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>

        {error && <p className="text-destructive text-xs">{error}</p>}

        {profile && (
          mode === '3d' ? (
            <div className="rounded-md overflow-hidden bg-black/30" style={{ height: 280 }}>
              <Scene3D profile={profile} />
            </div>
          ) : (
            <Heatmap2D profile={profile} />
          )
        )}

        {!profile && !loading && (
          <p className="text-muted-foreground text-xs text-center py-4">
            {lang === 'sv' ? 'Ingen bed mesh laddad' : 'No bed mesh loaded'}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
