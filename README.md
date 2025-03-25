# Video Stacker

Video Stacker is a web application that allows users to upload two videos, preview them, merge them by stacking them vertically, and perform face detection. This project leverages FFmpeg Web Assembly for efficient, client-side video processing and face-api.js for face detection.

## Features

- Upload and preview two videos simultaneously
- Merge videos by stacking them vertically
- Efficient client-side video processing using FFmpeg Web Assembly
- Face detection in uploaded videos using face-api.js
- Preview the merged video before downloading
- Download the final merged video

## Technologies Used

- React: A JavaScript library for building user interfaces
- Next.js: A React framework for production-grade applications
- TypeScript: A typed superset of JavaScript that compiles to plain JavaScript
- FFmpeg Web Assembly (@ffmpeg/ffmpeg, @ffmpeg/util): For client-side video processing
- face-api.js: For face detection in videos
- Tailwind CSS: A utility-first CSS framework for rapid UI development

## Installation

1. Clone the repository:
   ```
   git clone https://github.com/subigya-ukumi/shorts-player.git
   ```

   ```
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
   - Preview the uploaded videos
   - The application will automatically perform face detection on the uploaded videos
   - Click the "Merge Videos" button to stack the videos vertically
   - Once processing is complete, preview the merged video
   - Use the download link to save the merged video