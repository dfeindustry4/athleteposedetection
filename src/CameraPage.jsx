import React, { useEffect, useRef, useState } from 'react';
import { Pose } from '@mediapipe/pose';
import { Camera } from '@mediapipe/camera_utils';
import * as mpDrawing from '@mediapipe/drawing_utils';
import { angle3D } from './utils/calculation';


export default function PoseCamera() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const cameraRef = useRef(null);
  const poseRef = useRef(null);
  const rafRef = useRef(null);
  const timerRef = useRef(null);

  const [running, setRunning] = useState(false);
  const [mirror, setMirror] = useState(true);
  const [modelComplexity, setModelComplexity] = useState(1); // 0,1,2
  const [fps, setFps] = useState(0);
  const [lastResult, setLastResult] = useState(null);
  const [mediaRecorder, setMediaRecorder] = useState(null);



  useEffect(() => {
    const pose = new Pose({
      locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
      }
    });

    pose.setOptions({
      modelComplexity: modelComplexity,
      smoothLandmarks: true,
      enableSegmentation: false,
      smoothSegmentation: false,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5
    });

    pose.onResults(onResults);
    poseRef.current = pose;

    return () => {
      if (poseRef.current) {
        poseRef.current.close();
        poseRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (poseRef.current) {
      poseRef.current.setOptions({ modelComplexity });
    }
  }, [modelComplexity]);

  useEffect(() => {
    return () => {
      stopCamera();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);


  let recordedChunks = [];

  const getFilename = (ext = "mp4") => {
    return new Date().toISOString().replace(/[:.]/g, "-") + "." + ext;
  };

  function startRecording() {
      const canvas = canvasRef.current;
      const stream = canvas.captureStream(30); // capture canvas as video
      const Recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
      setMediaRecorder(Recorder);
      Recorder.ondataavailable = e => {
          if (e.data.size > 0) recordedChunks.push(e.data);
      };

      Recorder.onstop = () => {
          const blob = new Blob(recordedChunks, { type: 'video/webm' });
          recordedChunks = [];
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          // a.download = 'mediapipe_recording.webm';
          a.download = getFilename("webm");
          a.click();
          URL.revokeObjectURL(url);
      };

      Recorder.start();
      // ⏱ Auto-stop timer (5 min = 300000 ms)
      timerRef.current = setTimeout(() => {
        Recorder.stop(); 
        stopRecording();
      }, 300000);
      console.log('Recording started');
      console.log(Recorder);
  }

  function stopRecording() {
    if (timerRef.current) clearTimeout(timerRef.current);
    console.log("Stop recording");
      
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        console.log(mediaRecorder.state);
        mediaRecorder.stop(); 
    }
    
    console.log('Recording stopped');
    stopCamera();
  }


  function startCamera() {
    if (running) return;
    const video = videoRef.current;
    if (!video) return;

    const camera = new Camera(video, {
      onFrame: async () => {
        if (poseRef.current && video.readyState >= 2) {
          await poseRef.current.send({ image: video });
        }
      },
      width: 1280,
      height: 720
    });

    camera.start();
    cameraRef.current = camera;


    setRunning(true);
    startFpsCounter();
    startRecording();
  }

  function stopCamera() {
    console.log("Stop Camara");
   
    
    // stopRecording();
    if (cameraRef.current) {
      try { cameraRef.current.stop(); } catch (e) { /* ignore */ }
      cameraRef.current = null;
    }
    setRunning(false);
    stopFpsCounter();
    clearCanvas();

  }

  const fpsCounter = useRef({ last: performance.now(), frames: 0 });
  function startFpsCounter() {
    fpsCounter.current = { last: performance.now(), frames: 0 };
    const tick = () => {
      fpsCounter.current.frames++;
      const now = performance.now();
      const delta = now - fpsCounter.current.last;
      if (delta >= 500) {
        const f = Math.round((fpsCounter.current.frames * 1000) / delta);
        setFps(f);
        fpsCounter.current.last = now;
        fpsCounter.current.frames = 0;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }
  function stopFpsCounter() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    setFps(0);
  }

  function clearCanvas() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  function getSafeLandmark(landmarks, index) {
    return landmarks && landmarks[index] ? landmarks[index] : null;
  }

  function onResults(results) {
    setLastResult(results);
    drawResults(results);
  }

  function drawAngle(ctx, a, b, c, angle) {
    if (!a || !b || !c || angle == null) return;
    const canvas = canvasRef.current;
    ctx.fillStyle = "yellow";
    ctx.font = "20px Arial";

    ctx.beginPath();
    ctx.arc(b.x * canvas.width, b.y * canvas.height, 8, 0, 2 * Math.PI);
    ctx.fill();

    ctx.fillText(
      angle.toFixed(1) + "°",
      b.x * canvas.width + 10,
      b.y * canvas.height + 10
    );
  }


  function drawResults(results) {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const ctx = canvas.getContext('2d');
    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    }

    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (mirror) {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }

    try {
      ctx.globalAlpha = 0.8;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      ctx.globalAlpha = 1.0;
    } catch (e) {}

    if (results.poseLandmarks) {
      mpDrawing.drawConnectors(ctx, results.poseLandmarks, Pose.POSE_CONNECTIONS, {
        lineWidth: 4
      });
      mpDrawing.drawLandmarks(ctx, results.poseLandmarks, { radius: 4 });
      if(results.poseLandmarks && results.poseLandmarks.length>0){
        
        const lm = results.poseLandmarks;
      const toPx = (p) => ({
        x: p.x * canvas.width,
        y: p.y * canvas.height,
      });

        // const LS = getSafeLandmark(lm, 11);
        // const LE = getSafeLandmark(lm, 13);
        // const LW = getSafeLandmark(lm, 15);

        const LS = toPx(lm[11]);
        const LE = toPx(lm[13]);
        const LW = toPx(lm[15]);
        ctx.strokeStyle = "#00ff00";
        ctx.lineWidth = 4;

        ctx.beginPath();
        ctx.moveTo(LS.x, LS.y);
        ctx.lineTo(LE.x, LE.y);
        ctx.lineTo(LW.x, LW.y);
        ctx.stroke();

        // RIGHT ARM (12 → 14 → 16)
        // const RS = getSafeLandmark(lm, 12);
        // const RE = getSafeLandmark(lm, 14);
        // const RW = getSafeLandmark(lm, 16);

        const RS = toPx(lm[12]);
        const RE = toPx(lm[14]);
        const RW = toPx(lm[16]);

        ctx.beginPath();
        ctx.moveTo(RS.x, RS.y);
        ctx.lineTo(RE.x, RE.y);
        ctx.lineTo(RW.x, RW.y);
        ctx.stroke();


        // LEFT LEG (23 → 25 → 27)
        // const LH = getSafeLandmark(lm, 23);
        // const LK = getSafeLandmark(lm, 25);
        // const LA = getSafeLandmark(lm, 27);
        const LH = toPx(lm[23]);
        const LK = toPx(lm[25]);
        const LA = toPx(lm[27]);


        ctx.beginPath();
        ctx.moveTo(LH.x, LH.y);
        ctx.lineTo(LK.x, LK.y);
        ctx.lineTo(LA.x, LA.y);
        ctx.stroke();

        // RIGHT LEG (24 → 26 → 28)
        // const RH = getSafeLandmark(lm, 24);
        // const RK = getSafeLandmark(lm, 26);
        // const RA = getSafeLandmark(lm, 28);
        const RH = toPx(lm[24]);
        const RK = toPx(lm[26]);
        const RA = toPx(lm[28]);

        ctx.beginPath();
        ctx.moveTo(RH.x, RH.y);
        ctx.lineTo(RK.x, RK.y);
        ctx.lineTo(RA.x, RA.y);
        ctx.stroke();

        // Draw angle text
        const leftElbowAngle = angle3D(LS, LE, LW);
        // ctx.fillStyle = "#00ff00";
        // ctx.font = "26px Arial";
        // ctx.fillText(`${leftElbowAngle}°`, LE.x + 10, LE.y - 10);

        const rightElbowAngle = angle3D(RS, RE, RW);
        // ctx.fillStyle = "#00ff00";
        // ctx.font = "26px Arial";
        // ctx.fillText(`${rightElbowAngle}°`, RE.x + 10, RE.y - 10);

        const leftKneeAngle = angle3D(LH, LK, LA);
        // ctx.fillStyle = "#00ff00";
        // ctx.font = "26px Arial";
        // ctx.fillText(`${leftKneeAngle}°`, LK.x + 10, LK.y - 10);

        const rightKneeAngle = angle3D(RH, RK, RA);
        // ctx.fillStyle = "#00ff00";
        // ctx.font = "26px Arial";
        // ctx.fillText(`${rightKneeAngle}°`, RK.x + 10, RK.y - 10);

        // drawAngle(ctx, LS, LE, LW, leftElbowAngle);
        // drawAngle(ctx, RS, RE, RW, rightElbowAngle);

        // drawAngle(ctx, LH, LK, LA, leftKneeAngle);
        // drawAngle(ctx, RH, RK, RA, rightKneeAngle);


      }
    }

    ctx.restore();

    if (results.poseLandmarks) {
      const conf = estimatePoseConfidence(results.poseLandmarks);
      ctx.save();
      ctx.font = '14px system-ui, sans-serif';
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(8, 8, 160, 48);
      ctx.fillStyle = '#fff';
      ctx.fillText(`FPS: ${fps}`, 16, 28);
      ctx.fillText(`Conf: ${conf.toFixed(2)}`, 16, 48);
      ctx.restore();
    }
  }

  function estimatePoseConfidence(landmarks) {
    if (!landmarks || landmarks.length === 0) return 0;
    let sum = 0;
    let count = 0;
    for (const lm of landmarks) {
      if (typeof lm.visibility === 'number') { sum += lm.visibility; count++; }
    }
    return count ? sum / count : 1.0;
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,#0f172a,#0b1220)', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 1024, background: 'rgba(255,255,255,0.04)', borderRadius: 18, padding: 16, color: '#e6eef8' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2 style={{ margin: 0 }}>Motion</h2>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ fontSize: 13 }}>FPS: <strong style={{ fontFamily: 'monospace' }}>{fps}</strong></div>
            <button onClick={() => (running ? stopRecording() : startCamera())} style={{ padding: '8px 12px', borderRadius: 8, background: '#4f46e5', color: 'white', border: 'none' }}>
              {running ? 'Stop' : 'Start'}
            </button>
            <button onClick={() => setMirror(m => !m)} style={{ padding: '8px 12px', borderRadius: 8, background: '#374151', color: 'white', border: 'none' }}>
              {mirror ? 'Mirror On' : 'Mirror Off'}
            </button>
            <select value={modelComplexity} onChange={(e) => setModelComplexity(Number(e.target.value))} style={{ padding: 8, borderRadius: 8, background: '#111827', color: 'white' }}>
              <option value={0}>Lite</option>
              <option value={1}>Full</option>
              <option value={2}>Heavy</option>
            </select>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 12 }}>
          <div style={{ background: '#000', borderRadius: 12, overflow: 'hidden' }}>
            <video ref={videoRef} style={{ display: 'none' }} playsInline className="video-el" />
            <canvas ref={canvasRef} style={{ width: '100%', height: 'auto', display: 'block' }} />
          </div>

          <div style={{ padding: 12, background: 'rgba(255,255,255,0.03)', borderRadius: 12 }}>
            <div style={{ marginBottom: 8 }}>
              <strong>Instructions</strong>
              <div style={{ fontSize: 13, color: '#cbd5e1' }}>Allow camera access, click Start, and pose detection will appear on the canvas.</div>
            </div>

            <div style={{ marginTop: 12 }}>
              <strong>Latest result</strong>
              <pre style={{ marginTop: 8, padding: 8, background: 'rgba(0,0,0,0.4)', borderRadius: 8, maxHeight: 320, overflow: 'auto', fontSize: 12 }}>
                {JSON.stringify(summaryResult(lastResult), null, 2)}
              </pre>
            </div>

            <div style={{ marginTop: 12, fontSize: 13, color: '#9ca3af' }}>
              Built with MediaPipe Pose. Use Full/Heavy models for accuracy; Lite for speed.
            </div>
          </div>
        </div>

        <div style={{ marginTop: 12, textAlign: 'right', fontSize: 13, color: '#93c5fd' }}>
          Tip: run in a well-lit area for better detection.
        </div>
      </div>
    </div>
  );

  function summaryResult(results) {
    if (!results || !results.poseLandmarks) return { status: 'no-results' };
    return {
      landmarkCount: results.poseLandmarks.length,
      firstLandmarks: results.poseLandmarks.slice(0, 5).map(lm => ({ x: lm.x?.toFixed?.(3), y: lm.y?.toFixed?.(3), z: lm.z?.toFixed?.(3), visibility: lm.visibility?.toFixed ? Number(lm.visibility.toFixed(3)) : lm.visibility }))
      
    };
}
  }