# Video Stacker

Video Stacker is a web application that allows users to upload two videos, preview them, and merge them by stacking them vertically. This project uses FFmpeg Web Assembly for client-side video processing.

## Features

- Upload and preview two videos
- Merge videos by stacking them vertically
- Client-side video processing using FFmpeg Web Assembly
- Download the merged video

## Technologies Used

- React
- Next.js
- TypeScript
- FFmpeg Web Assembly (@ffmpeg/ffmpeg, @ffmpeg/util)

## Installation

1. Clone the repository:
   ```
   git clone https://github.com/subigya-ukumi/video-stacker.git
   cd shorts-player
   ```

2. Install dependencies:
   ```
   npm install
   ```

## Usage

1. Start the development server:
   ```
   npm run dev
   ```

2. Open your browser and navigate to `http://localhost:3000`

3. Use the application:
   - Upload two videos using the file input fields
   - Click the "Merge Videos" button to stack the videos vertically
   - Once processing is complete, preview the merged video
   - Use the download link to save the merged video

