import { useEffect, useRef } from "react";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  opacity: number;
  fadeSpeed: number;
  life: number;
  maxLife: number;
}

interface InkDrop {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  opacity: number;
  growing: boolean;
  speed: number;
}

interface FlyingBird {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  wingAngle: number;
  wingSpeed: number;
  opacity: number;
}

export default function InkCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    if (!ctx) return;

    let width = window.innerWidth;
    let height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;

    // 水墨粒子
    const particles: Particle[] = [];
    const maxParticles = 40;

    // 墨滴
    const inkDrops: InkDrop[] = [];
    const maxDrops = 6;

    // 飞鸽
    const birds: FlyingBird[] = [];
    const maxBirds = 3;

    function createParticle(): Particle {
      return {
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.2 - 0.1,
        radius: Math.random() * 3 + 1,
        opacity: Math.random() * 0.06 + 0.02,
        fadeSpeed: Math.random() * 0.0003 + 0.0001,
        life: 0,
        maxLife: Math.random() * 600 + 300,
      };
    }

    function createInkDrop(): InkDrop {
      return {
        x: Math.random() * width,
        y: Math.random() * height,
        radius: 0,
        maxRadius: Math.random() * 80 + 30,
        opacity: Math.random() * 0.03 + 0.01,
        growing: true,
        speed: Math.random() * 0.3 + 0.1,
      };
    }

    function createBird(): FlyingBird {
      const fromLeft = Math.random() > 0.5;
      return {
        x: fromLeft ? -30 : width + 30,
        y: Math.random() * height * 0.4 + height * 0.05,
        vx: fromLeft ? Math.random() * 0.8 + 0.3 : -(Math.random() * 0.8 + 0.3),
        vy: (Math.random() - 0.5) * 0.2,
        size: Math.random() * 6 + 4,
        wingAngle: 0,
        wingSpeed: Math.random() * 0.04 + 0.03,
        opacity: Math.random() * 0.15 + 0.05,
      };
    }

    // 初始化
    for (let i = 0; i < maxParticles; i++) {
      const p = createParticle();
      p.life = Math.random() * p.maxLife;
      particles.push(p);
    }
    for (let i = 0; i < maxDrops; i++) {
      const d = createInkDrop();
      d.radius = Math.random() * d.maxRadius;
      inkDrops.push(d);
    }
    for (let i = 0; i < maxBirds; i++) {
      const b = createBird();
      b.x = Math.random() * width;
      birds.push(b);
    }

    function drawBird(ctx: CanvasRenderingContext2D, bird: FlyingBird) {
      ctx.save();
      ctx.translate(bird.x, bird.y);
      ctx.globalAlpha = bird.opacity;

      const wingY = Math.sin(bird.wingAngle) * bird.size * 0.8;
      const direction = bird.vx > 0 ? 1 : -1;

      // 身体
      ctx.beginPath();
      ctx.ellipse(0, 0, bird.size * 0.6, bird.size * 0.2, 0, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(200, 200, 190, 0.8)";
      ctx.fill();

      // 左翅
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(-bird.size * 0.5 * direction, wingY - bird.size * 0.3, -bird.size * 1.2 * direction, wingY);
      ctx.quadraticCurveTo(-bird.size * 0.5 * direction, wingY * 0.3, 0, 0);
      ctx.fillStyle = "rgba(200, 200, 190, 0.6)";
      ctx.fill();

      // 右翅
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(bird.size * 0.5 * direction, wingY - bird.size * 0.3, bird.size * 1.2 * direction, wingY);
      ctx.quadraticCurveTo(bird.size * 0.5 * direction, wingY * 0.3, 0, 0);
      ctx.fillStyle = "rgba(200, 200, 190, 0.6)";
      ctx.fill();

      // 头
      ctx.beginPath();
      ctx.arc(bird.size * 0.5 * direction, -bird.size * 0.1, bird.size * 0.15, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(200, 200, 190, 0.9)";
      ctx.fill();

      ctx.restore();
    }

    function animate() {
      ctx.clearRect(0, 0, width, height);

      // 绘制墨滴晕染
      for (let i = 0; i < inkDrops.length; i++) {
        const drop = inkDrops[i];
        if (drop.growing) {
          drop.radius += drop.speed;
          if (drop.radius >= drop.maxRadius) {
            drop.growing = false;
          }
        } else {
          drop.opacity -= 0.0002;
          if (drop.opacity <= 0) {
            inkDrops[i] = createInkDrop();
            continue;
          }
        }

        const gradient = ctx.createRadialGradient(
          drop.x, drop.y, 0,
          drop.x, drop.y, drop.radius
        );
        gradient.addColorStop(0, `rgba(180, 175, 165, ${drop.opacity * 1.5})`);
        gradient.addColorStop(0.4, `rgba(160, 155, 145, ${drop.opacity})`);
        gradient.addColorStop(1, "rgba(160, 155, 145, 0)");

        ctx.beginPath();
        ctx.arc(drop.x, drop.y, drop.radius, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
      }

      // 绘制水墨粒子
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life++;

        // 生命周期淡入淡出
        let alpha = p.opacity;
        if (p.life < 60) {
          alpha = p.opacity * (p.life / 60);
        } else if (p.life > p.maxLife - 60) {
          alpha = p.opacity * ((p.maxLife - p.life) / 60);
        }

        if (p.life >= p.maxLife || p.x < -10 || p.x > width + 10 || p.y < -10 || p.y > height + 10) {
          particles[i] = createParticle();
          continue;
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(180, 175, 165, ${alpha})`;
        ctx.fill();

        // 墨迹拖尾
        if (p.radius > 2) {
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - p.vx * 8, p.y - p.vy * 8);
          ctx.strokeStyle = `rgba(180, 175, 165, ${alpha * 0.3})`;
          ctx.lineWidth = p.radius * 0.3;
          ctx.stroke();
        }
      }

      // 绘制飞鸽
      for (let i = 0; i < birds.length; i++) {
        const bird = birds[i];
        bird.x += bird.vx;
        bird.y += bird.vy + Math.sin(bird.wingAngle * 0.5) * 0.1;
        bird.wingAngle += bird.wingSpeed;

        if (bird.x < -50 || bird.x > width + 50) {
          birds[i] = createBird();
          continue;
        }

        drawBird(ctx, bird);
      }

      animRef.current = requestAnimationFrame(animate);
    }

    animate();

    const handleResize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;
    };
    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
      style={{ opacity: 0.8 }}
    />
  );
}
