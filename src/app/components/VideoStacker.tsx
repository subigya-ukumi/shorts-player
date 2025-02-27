"use client";
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';
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

  useEffect(() => {
    // Load FFmpeg
    const loadFFmpeg = async () => {
      try {
        await ffmpegRef.current.load();
      } catch (e) {
        console.error('Error loading FFmpeg:', e);
        setError('Failed to load FFmpeg. Video merging may not work.');
      }
    };
    loadFFmpeg();

    // Cleanup function to revoke object URLs
    return () => {
      if (video1Url) URL.revokeObjectURL(video1Url);
      if (video2Url) URL.revokeObjectURL(video2Url);
      if (mergedVideoUrl) URL.revokeObjectURL(mergedVideoUrl);
    };
  }, [video1Url, video2Url, mergedVideoUrl]);

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

      // Execute FFmpeg command to stack videos vertically
      await ffmpeg.exec([
        '-i', 'video1.mp4',
        '-i', 'video2.mp4',
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
      console.error('Error during video merging:', e);
      setError('Failed to merge videos. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className='flex flex-col gap-5'>
      <h1>Video Stacker</h1>
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
          <h2>Merged Video</h2>
          <video controls width="300" className='border border-blue-500 roundemd-md'>
            <source src={mergedVideoUrl} type="video/mp4" />
            Your browser does not support the video tag.
          </video>
          <div>
            <a href={mergedVideoUrl} download="merged_video.mp4" className='bg-blue-500 cursor-pointer py-2 px-4 text-sm w-auto text-white rounded-md'>Download Merged Video</a>
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoStacker;
