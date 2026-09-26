import React, { useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Video, 
  VideoOff, 
  Mic, 
  MicOff, 
  Play, 
  Pause, 
  RotateCcw,
  Upload,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Clock,
  Eye,
  Trash2,
  Download,
  Share2,
  Lightbulb,
  X
} from 'lucide-react';
import Header from '@/components/Header';

interface VideoProfile {
  id: string;
  title: string;
  duration: string;
  thumbnail: string;
  views: number;
  createdAt: string;
  status: 'draft' | 'published' | 'processing';
}

const VideoProfilePage: React.FC = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [hasCamera, setHasCamera] = useState(true);
  const [hasMic, setHasMic] = useState(true);
  const [showTips, setShowTips] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Mock existing videos
  const [existingVideos] = useState<VideoProfile[]>([
    {
      id: '1',
      title: 'My Introduction',
      duration: '0:45',
      thumbnail: '/images/employee-stories.jpg',
      views: 234,
      createdAt: '2 days ago',
      status: 'published',
    },
    {
      id: '2',
      title: 'Why I Love Coding',
      duration: '1:12',
      thumbnail: '/images/team-culture.jpg',
      views: 89,
      createdAt: '1 week ago',
      status: 'published',
    },
  ]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: true, 
        audio: true 
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setIsRecording(true);
      setIsPaused(false);
      setRecordingTime(0);
      
      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (error) {
      console.error('Error accessing camera:', error);
      setHasCamera(false);
    }
  };

  const stopRecording = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsRecording(false);
    setIsPaused(false);
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const togglePause = () => {
    setIsPaused(!isPaused);
    if (!isPaused && timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    } else if (isPaused) {
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const tips = [
    'Look directly at the camera to create connection',
    'Speak clearly and at a moderate pace',
    'Keep your video under 2 minutes for best engagement',
    'Use good lighting - face a window if possible',
    'Start with a strong introduction of yourself',
    'Mention your key skills and what you\'re looking for',
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <Header />
      
      <div className="h-16 bg-gradient-to-b from-white to-gray-50 dark:from-gray-900 dark:to-gray-950" />
      
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-500 to-purple-600 rounded-full text-white text-sm font-medium mb-4">
            <Video className="w-4 h-4" />
            Video First
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-3">
            Video Profile
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Stand out from the crowd with a video introduction. Let employers see your personality 
            and communication skills before the interview.
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Left Column - Recording Area */}
          <div className="lg:col-span-2 space-y-6">
            {/* Video Preview/Recording */}
            <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 overflow-hidden">
              <div className="aspect-video bg-gray-900 relative">
                {isRecording ? (
                  <>
                    <video
                      ref={videoRef}
                      autoPlay
                      muted
                      playsInline
                      className="w-full h-full object-cover"
                    />
                    {/* Recording indicator */}
                    <div className="absolute top-4 left-4 flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
                      <span className="text-white text-sm font-medium">REC {formatTime(recordingTime)}</span>
                    </div>
                    {/* Pause indicator */}
                    {isPaused && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <div className="text-white text-xl font-bold">PAUSED</div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-gray-400">
                    <Video className="w-16 h-16 mb-4" />
                    <p className="text-lg">Click "Start Recording" to begin</p>
                    <p className="text-sm mt-2">Your video will be recorded in HD quality</p>
                  </div>
                )}
              </div>
              
              <CardContent className="p-4">
                {/* Recording Controls */}
                <div className="flex items-center justify-center gap-4">
                  {!isRecording ? (
                    <Button
                      onClick={startRecording}
                      className="bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700"
                    >
                      <Video className="w-4 h-4 mr-2" />
                      Start Recording
                    </Button>
                  ) : (
                    <>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={togglePause}
                        className="dark:border-gray-700"
                      >
                        {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={stopRecording}
                      >
                        <VideoOff className="w-4 h-4 mr-2" />
                        Stop & Save
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => {
                          stopRecording();
                          setRecordingTime(0);
                        }}
                        className="dark:border-gray-700"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </Button>
                    </>
                  )}
                </div>

                {/* Device Status */}
                <div className="flex items-center justify-center gap-6 mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                  <div className="flex items-center gap-2">
                    {hasCamera ? (
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-red-500" />
                    )}
                    <span className="text-sm text-gray-600 dark:text-gray-400">Camera</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {hasMic ? (
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-red-500" />
                    )}
                    <span className="text-sm text-gray-600 dark:text-gray-400">Microphone</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Existing Videos */}
            <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
              <CardHeader>
                <CardTitle className="text-gray-900 dark:text-white">Your Videos</CardTitle>
                <CardDescription>Manage your recorded video profiles</CardDescription>
              </CardHeader>
              <CardContent>
                {existingVideos.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    <Video className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No videos yet. Record your first video introduction!</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {existingVideos.map((video) => (
                      <div 
                        key={video.id}
                        className="flex items-center gap-4 p-3 rounded-lg bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      >
                        {/* Thumbnail */}
                        <div className="relative w-24 h-16 rounded-lg overflow-hidden bg-gray-200 dark:bg-gray-700 flex-shrink-0">
                          <img 
                            src={video.thumbnail} 
                            alt={video.title}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                            <Play className="w-6 h-6 text-white" />
                          </div>
                          <div className="absolute bottom-1 right-1 bg-black/70 text-white text-xs px-1 rounded">
                            {video.duration}
                          </div>
                        </div>
                        
                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-gray-900 dark:text-white truncate">{video.title}</h4>
                          <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400 mt-1">
                            <span className="flex items-center gap-1">
                              <Eye className="w-3 h-3" />
                              {video.views} views
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {video.createdAt}
                            </span>
                          </div>
                        </div>
                        
                        {/* Status & Actions */}
                        <div className="flex items-center gap-2">
                          <Badge 
                            className={video.status === 'published' 
                              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-0'
                              : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-0'
                            }
                          >
                            {video.status}
                          </Badge>
                          <Button variant="ghost" size="icon" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                            <Share2 className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="text-gray-400 hover:text-red-500">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Tips & Upload */}
          <div className="space-y-6">
            {/* Recording Tips */}
            {showTips && (
              <Card className="bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/30 border-violet-200 dark:border-violet-800">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2 text-violet-900 dark:text-violet-100">
                      <Lightbulb className="w-5 h-5" />
                      Recording Tips
                    </CardTitle>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-6 w-6 text-violet-400"
                      onClick={() => setShowTips(false)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {tips.map((tip, index) => (
                      <li key={index} className="flex items-start gap-2 text-sm text-violet-700 dark:text-violet-300">
                        <CheckCircle2 className="w-4 h-4 text-violet-500 mt-0.5 flex-shrink-0" />
                        {tip}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Upload Option */}
            <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
              <CardHeader>
                <CardTitle className="text-base text-gray-900 dark:text-white">Upload Video</CardTitle>
                <CardDescription>Already have a video? Upload it directly</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg p-6 text-center hover:border-violet-400 dark:hover:border-violet-600 transition-colors cursor-pointer">
                  <Upload className="w-8 h-8 text-gray-400 mx-auto mb-3" />
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                    Drag and drop or click to upload
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    MP4, MOV, AVI up to 100MB
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Stats */}
            <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
              <CardHeader>
                <CardTitle className="text-base text-gray-900 dark:text-white">Your Video Stats</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Total Views</span>
                  <span className="font-semibold text-gray-900 dark:text-white">323</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Videos Published</span>
                  <span className="font-semibold text-gray-900 dark:text-white">2</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Profile Completion</span>
                  <span className="font-semibold text-violet-600 dark:text-violet-400">85%</span>
                </div>
                <Progress value={85} className="h-2" />
              </CardContent>
            </Card>

            {/* Benefits */}
            <Card className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 border-emerald-200 dark:border-emerald-800">
              <CardContent className="p-4">
                <h4 className="font-medium text-emerald-900 dark:text-emerald-100 mb-3 flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  Why Video Profiles?
                </h4>
                <ul className="space-y-2 text-sm text-emerald-700 dark:text-emerald-300">
                  <li>• 3x more profile views</li>
                  <li>• 40% higher response rate</li>
                  <li>• Stand out from text-only profiles</li>
                  <li>• Showcase communication skills</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoProfilePage;
