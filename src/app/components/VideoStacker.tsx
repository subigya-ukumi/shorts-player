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
  const ffmpegRef = useRef(new FFmpeg());
  const mergedVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const loadDependencies = async () => {
      try {
        await ffmpegRef.current.load();
        await faceapi.nets.tinyFaceDetector.loadFromUri('/models');
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

      // Process and merge videos
      await mergeAndProcessVideos(ffmpeg, 'video1.mp4', 'video2.mp4', 'output.mp4');

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

  const mergeAndProcessVideos = async (ffmpeg: FFmpeg, video1: string, video2: string, output: string) => {
    const [dims1, dims2] = await Promise.all([
      getFaceDimensions(ffmpeg, video1),
      getFaceDimensions(ffmpeg, video2)
    ]);

    await ffmpeg.exec([
      '-i', video1,
      '-i', video2,
      '-filter_complex',
      `[0:v]crop=${dims1.width}:${dims1.height}:${dims1.x}:${dims1.y},scale=720:640[v1];` +
      `[1:v]crop=${dims2.width}:${dims2.height}:${dims2.x}:${dims2.y},scale=720:640[v2];` +
      '[v1][v2]vstack=inputs=2[v];[0:a][1:a]amerge[a]',
      '-map', '[v]', '-map', '[a]',
      '-c:v', 'libx264',
      '-crf', '23',
      '-preset', 'veryfast',
      output
    ]);
  };

  const getFaceDimensions = async (ffmpeg: FFmpeg, inputFile: string) => {
    const tempData = await ffmpeg.readFile(inputFile);
    const tempBlob = new Blob([tempData], { type: 'video/mp4' });
    const tempUrl = URL.createObjectURL(tempBlob);

    const { videoWidth, videoHeight, faceDetection } = await detectFaceInVideo(tempUrl);

    URL.revokeObjectURL(tempUrl);

    if (!faceDetection) {
      throw new Error(`Face detection failed for ${inputFile}`);
    }

    return calculateCropDimensions(faceDetection, videoWidth, videoHeight);
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

    video.currentTime = 0; // Process the first frame
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
            >
              <source src={mergedVideoUrl} type="video/mp4" />
              Your browser does not support the video tag.
            </video>
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