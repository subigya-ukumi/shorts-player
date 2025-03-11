"use client";
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';
import * as faceapi from 'face-api.js';
import React, { useEffect, useRef, useState } from 'react';

const VideoStacker = () => {
  const [video1, setVideo1] = useState<File | null>(null);
  const [video2, setVideo2] = useState<File | null>(null);
  const [video1Url, setVideo1Url] = useState<string | null>(null);
  const [video2Url, setVideo2Url] = useState<string | null>(null);
  const [mergedVideoUrl, setMergedVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [faceDetectionReady, setFaceDetectionReady] = useState(false);
  const ffmpegRef = useRef(new FFmpeg());
  const mergedVideoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const loadDependencies = async () => {
      try {
        await ffmpegRef.current.load();
        await faceapi.nets.tinyFaceDetector.loadFromUri('/models');
        setFaceDetectionReady(true);
      } catch (e) {
        console.error('Error loading dependencies:', e);
        setError('Failed to load dependencies. Video merging or face detection may not work.');
      }
    };
    loadDependencies();

    return () => {
      if (video1Url) URL.revokeObjectURL(video1Url);
      if (video2Url) URL.revokeObjectURL(video2Url);
      if (mergedVideoUrl) URL.revokeObjectURL(mergedVideoUrl);
    };
  }, []);

  const handleVideoChange = (event: React.ChangeEvent<HTMLInputElement>, setVideo: React.Dispatch<React.SetStateAction<File | null>>, setVideoUrl: React.Dispatch<React.SetStateAction<string | null>>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('video/')) {
        setError('Please select a valid video file.');
        return;
      }
      setError(null);
      setVideo(file);
      try {
        const url = URL.createObjectURL(file);
        setVideoUrl(url);
      } catch (e) {
        setError('Error creating video preview.');
        console.error('Error creating object URL:', e);
      }
    }
  };

  const mergeVideos = async () => {
    if (!video1 || !video2) {
      setError('Please select both videos before merging.');
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      const ffmpeg = ffmpegRef.current;

      // Write video files to FFmpeg's virtual file system
      await ffmpeg.writeFile('video1.mp4', await fetchFile(video1));
      await ffmpeg.writeFile('video2.mp4', await fetchFile(video2));

      // Process each video individually
      await processVideo(ffmpeg, 'video1.mp4', 'processed1.mp4');
      await processVideo(ffmpeg, 'video2.mp4', 'processed2.mp4');

      // Stack the processed videos
      await ffmpeg.exec([
        '-i', 'processed1.mp4',
        '-i', 'processed2.mp4',
        '-filter_complex', '[0:v][1:v]vstack=inputs=2[v];[0:a][1:a]amerge[a]',
        '-map', '[v]', '-map', '[a]',
        '-c:v', 'libx264',
        '-crf', '23',
        '-preset', 'veryfast',
        'output.mp4'
      ]);

      // Read the output file
      const data = await ffmpeg.readFile('output.mp4');
      const blob = new Blob([data], { type: 'video/mp4' });
      const url = URL.createObjectURL(blob);
      setMergedVideoUrl(url);

    } catch (e) {
      console.error('Error during video processing:', e);
      setError('Failed to process videos. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const processVideo = async (ffmpeg: FFmpeg, inputFile: string, outputFile: string) => {
    // Create a temporary URL for face detection
    const tempData = await ffmpeg.readFile(inputFile);
    const tempBlob = new Blob([tempData], { type: 'video/mp4' });
    const tempUrl = URL.createObjectURL(tempBlob);

    // Get video dimensions and perform face detection
    const { videoWidth, videoHeight, faceDetection } = await detectFaceInVideo(tempUrl);

    // Clean up temporary URL
    URL.revokeObjectURL(tempUrl);

    if (!faceDetection) {
      throw new Error(`Face detection failed for ${inputFile}`);
    }

    // Calculate crop dimensions
    const { x, y, width, height } = calculateCropDimensions(faceDetection, videoWidth, videoHeight);

    // Apply cropping and zooming using FFmpeg
    await ffmpeg.exec([
      '-i', inputFile,
      '-filter:v', `crop=${width}:${height}:${x}:${y},scale=720:640`,
      '-c:a', 'copy',
      outputFile
    ]);
  };

  const detectFaceInVideo = async (videoUrl: string): Promise<{ videoWidth: number, videoHeight: number, faceDetection: faceapi.FaceDetection | null }> => {
    const video = document.createElement('video');
    video.src = videoUrl;
    await new Promise((resolve) => {
      video.onloadedmetadata = () => {
        video.width = video.videoWidth;
        video.height = video.videoHeight;
        resolve(null);
      };
    });

    video.currentTime = 1; // Set to 1 second to ensure the video has loaded a frame
    await new Promise((resolve) => {
      video.onseeked = resolve;
    });

    const detection = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions());
    return { videoWidth: video.width, videoHeight: video.height, faceDetection: detection || null };
  };

  const calculateCropDimensions = (
    faceDetection: faceapi.FaceDetection,
    videoWidth: number,
    videoHeight: number
  ) => {
    const { x, y, width, height } = faceDetection.box;
    const centerX = x + width / 2;
    const centerY = y + height / 2;

    // Calculate 2x face size
    let cropWidth = width * 2.5;
    let cropHeight = height * 2.5;

    // Ensure crop doesn't exceed video boundaries
    cropWidth = Math.min(cropWidth, videoWidth);
    cropHeight = Math.min(cropHeight, videoHeight);

    // Calculate crop coordinates
    let cropX = Math.max(0, centerX - cropWidth / 2);
    let cropY = Math.max(0, centerY - cropHeight / 2);

    // Adjust if crop goes out of bounds
    if (cropX + cropWidth > videoWidth) {
      cropX = videoWidth - cropWidth;
    }
    if (cropY + cropHeight > videoHeight) {
      cropY = videoHeight - cropHeight;
    }

    return {
      x: Math.round(cropX),
      y: Math.round(cropY),
      width: Math.round(cropWidth),
      height: Math.round(cropHeight)
    };
  };

  const handleVideoPlay = async () => {
    if (!faceDetectionReady || !mergedVideoRef.current || !canvasRef.current) return;

    const video = mergedVideoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const detectFaces = async () => {
      const detectFacesInterval = setInterval(async () => {
        if (video.paused || video.ended) {
          clearInterval(detectFacesInterval);
          return;
        }

        const detections = await faceapi.detectAllFaces(video, new faceapi.TinyFaceDetectorOptions());
        const displaySize = { width: video.videoWidth, height: video.videoHeight };
        const resizedDetections = faceapi.resizeResults(detections, displaySize);
        
        canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
        faceapi.draw.drawDetections(canvas, resizedDetections);

        console.log(`Faces detected: ${detections.length}`);
      }, 100); // Changed from 100 to 1000 milliseconds
    };

    detectFaces();
  };

  return (
    <div className='flex flex-col gap-5'>
      <h1>Video Stacker with Face Detection</h1>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <div className='flex gap-10'>
        <div className='flex flex-col gap-2'>
          <input type="file" accept="video/*" onChange={(e) => handleVideoChange(e, setVideo1, setVideo1Url)} />
          {video1Url && (
            <video controls width="300">
              <source src={video1Url} type={video1?.type} />
              Your browser does not support the video tag.
            </video>
          )}
        </div>
        <div className='flex flex-col gap-2'>
          <input type="file" accept="video/*" onChange={(e) => handleVideoChange(e, setVideo2, setVideo2Url)} />
          {video2Url && (
            <video controls width="300">
              <source src={video2Url} type={video2?.type} />
              Your browser does not support the video tag.
            </video>
          )}
        </div>
      </div>

      <div>
        <button onClick={mergeVideos} disabled={!video1 || !video2 || processing} className='bg-blue-500 cursor-pointer py-2 px-4 text-sm w-auto text-white rounded-md'>
          {processing ? 'Merging...' : 'Merge Videos'}
        </button>
      </div>
      {mergedVideoUrl && (
        <div className='flex flex-col gap-2'>
          <h2>Merged Video with Face Detection</h2>
          <div style={{ position: 'relative', width: '300px' }}>
            <video
              ref={mergedVideoRef}
              controls
              width="300"
              className='border border-blue-500 rounded-md'
              onPlay={handleVideoPlay}
            >
              <source src={mergedVideoUrl} type="video/mp4" />
              Your browser does not support the video tag.
            </video>
            <canvas
              ref={canvasRef}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
              }}
            />
          </div>
          <div>
            <a href={mergedVideoUrl} download="merged_video.mp4" className='bg-blue-500 cursor-pointer py-2 px-4 text-sm w-auto text-white rounded-md'>Download Merged Video</a>
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoStacker;