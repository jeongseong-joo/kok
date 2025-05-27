import { useState, useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { VoteWithDetails, CommentWithUser } from "@shared/schema";
import { useAuth } from "@/hooks/useAuth";

// 남은 시간 계산 함수
function getTimeRemaining(endDate: Date | string | null): string {
  if (!endDate) return "무제한";
  
  const end = typeof endDate === 'string' ? new Date(endDate) : endDate;
  const now = new Date();
  const diff = end.getTime() - now.getTime();
  
  if (diff <= 0) return "종료됨";
  
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  
  if (days > 0) return `${days}일 ${hours}시간 남음`;
  if (hours > 0) return `${hours}시간 ${minutes}분 남음`;
  return `${minutes}분 남음`;
}

// 공유 함수
function shareVote(vote: VoteWithDetails) {
  const shareTitle = `🗳️ ${vote.question}`;
  const shareText = `📍 ${vote.region.name}에서 진행중인 투표입니다!\n\n"${vote.question}"\n\n투표 참여 기간: ${getTimeRemaining(vote.endsAt)}\n현재 ${vote.totalVotes}명 참여\n\n투표에 참여해보세요! 👆`;
  const shareUrl = `${window.location.origin}?vote=${vote.id}`;
  
  // 모바일에서 Web Share API 사용 (카카오톡, 메시지 앱 포함)
  if (navigator.share && navigator.userAgent.includes('Mobile')) {
    navigator.share({
      title: shareTitle,
      text: shareText,
      url: shareUrl,
    }).catch((error) => {
      console.log('공유 취소:', error);
      // 공유 취소 시 클립보드 복사로 대체
      fallbackShare();
    });
  } else {
    // 데스크톱이나 Web Share API 미지원 시
    fallbackShare();
  }
  
  function fallbackShare() {
    const fullShareText = `${shareText}\n\n${shareUrl}`;
    
    // 클립보드 복사
    navigator.clipboard.writeText(fullShareText).then(() => {
      // 성공 메시지와 함께 공유 옵션 제공
      const userAgent = navigator.userAgent;
      let message = '투표 링크가 복사되었습니다!';
      
      if (userAgent.includes('Android')) {
        message += '\n\n카카오톡이나 메시지 앱에서 붙여넣기 하여 공유하세요.';
      } else if (userAgent.includes('iPhone') || userAgent.includes('iPad')) {
        message += '\n\n메시지 앱이나 카카오톡에서 붙여넣기 하여 공유하세요.';
      } else {
        message += '\n\n원하는 앱에서 붙여넣기 하여 공유하세요.';
      }
      
      alert(message);
    }).catch(() => {
      // 클립보드 복사 실패 시 텍스트 선택
      const textArea = document.createElement('textarea');
      textArea.value = fullShareText;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      alert('투표 링크가 복사되었습니다!\n\n카카오톡이나 메시지 앱에서 붙여넣기 하여 공유하세요.');
    });
  }
}

interface VoteCardProps {
  vote: VoteWithDetails;
  onVoteSuccess?: () => void;
  isHot?: boolean;
}

export default function VoteCard({ vote, onVoteSuccess, isHot }: VoteCardProps) {
  const [selectedOptionId, setSelectedOptionId] = useState<number | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth() as { user: any };
  const [userSettings, setUserSettings] = useState<any>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editQuestion, setEditQuestion] = useState(vote.question);
  const [editOptions, setEditOptions] = useState(vote.options.map(opt => opt.text));
  const [isManageMenuOpen, setIsManageMenuOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const [newComment, setNewComment] = useState("");

  // 댓글 목록 조회
  const { data: comments = [], refetch: refetchComments } = useQuery<CommentWithUser[]>({
    queryKey: [`/api/votes/${vote.id}/comments`],
    enabled: isCommentsOpen,
  });

  // 사용자 설정 로드
  useEffect(() => {
    if (user?.id) {
      const savedSettings = localStorage.getItem(`userSettings_${user.id}`);
      if (savedSettings) {
        setUserSettings(JSON.parse(savedSettings));
      }
    }
  }, [user?.id]);

  // 드롭다운 외부 클릭 감지
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (isManageMenuOpen && !target.closest('.manage-menu-container')) {
        setIsManageMenuOpen(false);
      }
    };

    if (isManageMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isManageMenuOpen]);

  // 초성 생성 함수
  const getInitials = (firstName?: string, lastName?: string, email?: string, nickname?: string) => {
    if (nickname) {
      return nickname.charAt(0).toUpperCase();
    }
    if (firstName && lastName) {
      return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
    }
    if (email) {
      return email.charAt(0).toUpperCase();
    }
    return "U";
  };

  const castVoteMutation = useMutation({
    mutationFn: async (optionId: number) => {
      await apiRequest("POST", `/api/votes/${vote.id}/cast`, { optionId });
    },
    onSuccess: () => {
      toast({
        title: "투표 완료",
        description: "투표가 성공적으로 등록되었습니다.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/votes"] });
      onVoteSuccess?.();
    },
    onError: (error: any) => {
      toast({
        title: "투표 실패",
        description: error.message || "투표 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    },
  });

  const updateVoteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("PUT", `/api/votes/${vote.id}`, {
        question: editQuestion,
        options: editOptions
      });
    },
    onSuccess: () => {
      toast({
        title: "투표 수정 완료",
        description: "투표가 성공적으로 수정되었습니다.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/votes"] });
      setIsEditModalOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "수정 실패",
        description: error.message || "투표 수정 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    },
  });

  const deleteVoteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/votes/${vote.id}`);
    },
    onSuccess: () => {
      toast({
        title: "투표 삭제 완료",
        description: "투표가 성공적으로 삭제되었습니다.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/votes"] });
    },
    onError: (error: any) => {
      toast({
        title: "삭제 실패",
        description: error.message || "투표 삭제 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    },
  });

  // 댓글 작성 뮤테이션
  const createCommentMutation = useMutation({
    mutationFn: async (commentText: string) => {
      await apiRequest("POST", `/api/votes/${vote.id}/comments`, {
        text: commentText,
      });
    },
    onSuccess: () => {
      setNewComment("");
      // 댓글 목록과 투표 데이터 모두 새로고침
      refetchComments();
      queryClient.invalidateQueries({ queryKey: ["/api/votes"] });
      if (onVoteSuccess) {
        onVoteSuccess();
      }
    },
    onError: (error: any) => {
      toast({
        title: "댓글 작성 실패",
        description: error.message || "댓글 작성 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    },
  });

  // 댓글 삭제 뮤테이션
  const deleteCommentMutation = useMutation({
    mutationFn: async (commentId: number) => {
      await apiRequest("DELETE", `/api/comments/${commentId}`);
    },
    onSuccess: () => {
      toast({
        title: "댓글 삭제 완료",
        description: "댓글이 성공적으로 삭제되었습니다.",
      });
      // 댓글 목록과 투표 데이터 모두 새로고침
      refetchComments();
      queryClient.invalidateQueries({ queryKey: ["/api/votes"] });
      if (onVoteSuccess) {
        onVoteSuccess();
      }
    },
    onError: (error: any) => {
      toast({
        title: "댓글 삭제 실패",
        description: error.message || "댓글 삭제 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    },
  });

  // 좋아요 토글 뮤테이션
  const toggleLikeMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/votes/${vote.id}/like`, {});
      return await response.json();
    },
    onSuccess: (data: any) => {
      // 모든 투표 관련 캐시 무효화
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          return query.queryKey[0] === "/api/votes";
        }
      });
      
      if (onVoteSuccess) {
        onVoteSuccess();
      }
    },
    onError: (error: any) => {
      toast({
        title: "좋아요 실패",
        description: error.message || "좋아요 처리 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    },
  });

  const handleVote = () => {
    if (selectedOptionId && !vote.hasUserVoted) {
      castVoteMutation.mutate(selectedOptionId);
    }
  };

  const handleVoteForOption = (optionId: number) => {
    if (!vote.hasUserVoted && vote.isActive) {
      castVoteMutation.mutate(optionId);
    }
  };

  const handleEdit = () => {
    console.log("수정 버튼 클릭됨", vote.id);
    setEditQuestion(vote.question);
    setEditOptions(vote.options.map(opt => opt.text));
    setIsEditModalOpen(true);
  };

  const handleDelete = () => {
    console.log("삭제 버튼 클릭됨", vote.id);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    console.log("삭제 확인됨", vote.id);
    deleteVoteMutation.mutate();
    setIsDeleteDialogOpen(false);
  };

  // 댓글 작성 핸들러
  const handleCommentSubmit = () => {
    if (newComment.trim()) {
      createCommentMutation.mutate(newComment.trim());
    }
  };

  // Enter 키로 댓글 작성
  const handleCommentKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleCommentSubmit();
    }
  };

  // 좋아요 토글 핸들러
  const handleToggleLike = () => {
    console.log("좋아요 버튼 클릭됨:", vote.id, "현재 상태:", vote.hasUserLiked);
    toggleLikeMutation.mutate();
  };

  // 댓글 삭제 핸들러
  const handleDeleteComment = (commentId: number) => {
    if (window.confirm("정말로 이 댓글을 삭제하시겠습니까?")) {
      deleteCommentMutation.mutate(commentId);
    }
  };

  const handleSaveEdit = () => {
    if (!editQuestion.trim()) {
      toast({
        title: "오류",
        description: "투표 제목을 입력해주세요.",
        variant: "destructive",
      });
      return;
    }
    
    const validOptions = editOptions.filter(opt => opt.trim());
    if (validOptions.length < 2) {
      toast({
        title: "오류", 
        description: "최소 2개 이상의 선택지를 입력해주세요.",
        variant: "destructive",
      });
      return;
    }

    updateVoteMutation.mutate();
  };

  const addOption = () => {
    setEditOptions([...editOptions, '']);
  };

  const removeOption = (index: number) => {
    if (editOptions.length > 2) {
      setEditOptions(editOptions.filter((_, i) => i !== index));
    }
  };

  const updateOption = (index: number, value: string) => {
    const newOptions = [...editOptions];
    newOptions[index] = value;
    setEditOptions(newOptions);
  };

  const formatTimeAgo = (date: string) => {
    const now = new Date();
    const voteDate = new Date(date);
    const diffMs = now.getTime() - voteDate.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) {
      return `${diffDays}일 전`;
    } else if (diffHours > 0) {
      return `${diffHours}시간 전`;
    } else {
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      return `${diffMinutes}분 전`;
    }
  };

  const formatTimeRemaining = (endDate: string | Date | null) => {
    if (!endDate || !vote.isActive) return null;
    
    const now = new Date();
    const end = typeof endDate === 'string' ? new Date(endDate) : endDate;
    const diffMs = end.getTime() - now.getTime();
    
    if (diffMs <= 0) {
      return "투표 종료";
    }
    
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (diffDays > 0) {
      return `${diffDays}일 ${diffHours}시간 남음`;
    } else if (diffHours > 0) {
      return `${diffHours}시간 ${diffMinutes}분 남음`;
    } else {
      return `${diffMinutes}분 남음`;
    }
  };

  return (
    <div>
      <Card className="bg-ios-card border-gray-700 shadow-ios">
        <CardContent className="p-4">
          <div className="flex items-start space-x-3 mb-3">
          {/* Creator Avatar */}
          {(() => {
            // 현재 로그인한 사용자가 투표 생성자인 경우 설정된 프로필 사용
            if (user?.id === vote.creator.id && userSettings) {
              if (userSettings.profileType === 'initial') {
                return (
                  <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-full flex items-center justify-center border border-emerald-400/30">
                    <span className="text-white text-sm font-bold">
                      {getInitials(vote.creator.firstName || '', vote.creator.lastName || '', vote.creator.email || '', userSettings?.currentNickname)}
                    </span>
                  </div>
                );
              } else if (userSettings.customProfileImage) {
                return (
                  <img 
                    src={userSettings.customProfileImage} 
                    alt="Creator avatar" 
                    className="w-10 h-10 rounded-full object-cover"
                  />
                );
              }
            }
            
            // 기본 프로필 표시
            if (vote.creator.profileImageUrl) {
              return (
                <img 
                  src={vote.creator.profileImageUrl} 
                  alt="Creator avatar" 
                  className="w-10 h-10 rounded-full object-cover"
                />
              );
            } else {
              return (
                <div className="w-10 h-10 bg-ios-blue rounded-full flex items-center justify-center">
                  <i className="fas fa-user text-white text-sm"></i>
                </div>
              );
            }
          })()}
          
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center space-x-2">
                <span className="font-medium text-sm text-white">
                  {(() => {
                    // 현재 로그인한 사용자가 투표 생성자인 경우 설정된 이름 사용
                    if (user?.id === vote.creator.id && userSettings) {
                      if (userSettings.displayName === 'nickname' && userSettings.currentNickname) {
                        return userSettings.currentNickname;
                      }
                    }
                    
                    // 기본 이름 표시
                    if (vote.creator.firstName && vote.creator.lastName) {
                      return `${vote.creator.firstName} ${vote.creator.lastName}`;
                    }
                    return vote.creator.email || "익명";
                  })()}
                </span>
                <span className="text-xs text-ios-gray">
                  {formatTimeAgo(vote.createdAt?.toString() || new Date().toISOString())}
                </span>
                <span className="px-3 py-1 text-xs rounded-full bg-gray-600 bg-opacity-20 text-gray-300 font-medium border border-gray-600 border-opacity-30">
                  {vote.region.name}
                </span>
              </div>
              
              <div className="flex items-center space-x-2">
                {/* HOT 배지 */}
                {isHot && (
                  <span className="px-2 py-1 text-xs font-bold rounded-full bg-gradient-to-r from-red-500 to-orange-500 text-white flex items-center space-x-1 shadow-lg animate-pulse">
                    <svg 
                      width="12" 
                      height="12" 
                      viewBox="0 0 24 24" 
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="w-3 h-3"
                    >
                      <rect x="6" y="2" width="12" height="20" rx="2"/>
                      <circle cx="12" cy="18" r="3"/>
                      <rect x="6" y="7" width="12" height="6" fill="currentColor"/>
                    </svg>
                    <span>HOT</span>
                  </span>
                )}
                
                {/* 투표 생성자만 보이는 관리 버튼 */}
                {user?.id === vote.creator.id && (
                  <div className="relative manage-menu-container">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        console.log("망치 버튼 클릭됨");
                        setIsManageMenuOpen(!isManageMenuOpen);
                      }}
                      className="text-white hover:text-gray-300 transition-colors p-2 bg-gray-700 hover:bg-gray-600 rounded-lg shadow-lg"
                      title="투표 관리"
                    >
                      <svg 
                        width="18" 
                        height="18" 
                        viewBox="0 0 24 24" 
                        fill="none" 
                        stroke="currentColor" 
                        strokeWidth="2" 
                        strokeLinecap="round" 
                        strokeLinejoin="round"
                        className="w-[18px] h-[18px]"
                      >
                        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
                      </svg>
                    </button>
                    
                    {/* 드롭다운 메뉴 */}
                    {isManageMenuOpen && (
                      <div className="absolute right-0 top-full mt-2 w-40 bg-gray-800 border border-gray-600 rounded-lg shadow-xl z-50">
                        <div className="p-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              console.log("수정 메뉴 클릭됨");
                              setIsManageMenuOpen(false);
                              handleEdit();
                            }}
                            className="w-full text-left px-3 py-2 text-sm text-white hover:bg-blue-600 rounded-md transition-colors flex items-center space-x-2"
                          >
                            <i className="fas fa-edit text-blue-400"></i>
                            <span>투표 수정</span>
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              console.log("삭제 메뉴 클릭됨");
                              setIsManageMenuOpen(false);
                              handleDelete();
                            }}
                            className="w-full text-left px-3 py-2 text-sm text-white hover:bg-red-600 rounded-md transition-colors flex items-center space-x-2"
                          >
                            <i className="fas fa-trash text-red-400"></i>
                            <span>투표 삭제</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            <p className="text-sm text-gray-300 leading-relaxed">
              {vote.question}
            </p>
          </div>
        </div>

        {/* Vote Options */}
        <div className="space-y-2 mb-3">
          {vote.options.map((option) => (
            <div key={option.id} className="relative">
              <button
                onClick={() => !vote.hasUserVoted && vote.isActive && handleVoteForOption(option.id)}
                disabled={vote.hasUserVoted || !vote.isActive || castVoteMutation.isPending}
                className={`w-full flex items-center justify-between p-3 rounded-lg transition-all min-h-[40px] ${
                  vote.hasUserVoted || !vote.isActive
                    ? "bg-gray-800 cursor-not-allowed"
                    : selectedOptionId === option.id
                    ? "bg-ios-blue bg-opacity-30 border border-ios-blue"
                    : "bg-gray-800 hover:bg-gray-700"
                } ${vote.userVotedOptionId === option.id ? "ring-2 ring-ios-green" : ""}`}
              >
                <span className="text-sm text-white">{option.text}</span>
                <span className="text-sm font-medium text-white">
                  {option.percentage}%
                </span>
              </button>
              {/* Progress bar */}
              <div 
                className="absolute inset-y-0 left-0 rounded-xl transition-all duration-300 bg-white bg-opacity-5"
                style={{ width: `${option.percentage}%` }}
              />
            </div>
          ))}
        </div>



        {/* Vote Stats and Actions */}
        <div className="pt-3 border-t border-gray-700 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <span className="text-xs text-ios-gray">
                총 {vote.totalVotes}명 참여
              </span>
              <button 
                onClick={() => shareVote(vote)}
                className="text-white hover:text-ios-blue transition-colors"
                title="투표 공유하기"
              >
                <svg 
                  width="16" 
                  height="16" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                  className="w-4 h-4"
                >
                  <circle cx="18" cy="5" r="3"/>
                  <circle cx="6" cy="12" r="3"/>
                  <circle cx="18" cy="19" r="3"/>
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
                  <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                </svg>
              </button>
              <button 
                onClick={handleToggleLike}
                disabled={toggleLikeMutation.isPending}
                className={`flex items-center space-x-1 transition-all duration-200 ${
                  vote.hasUserLiked 
                    ? 'text-red-500 hover:text-red-400' 
                    : 'text-gray-400 hover:text-red-400'
                } ${toggleLikeMutation.isPending ? 'opacity-50' : ''}`}
                title={vote.hasUserLiked ? "좋아요 취소" : "좋아요"}
              >
                <svg 
                  width="18" 
                  height="18" 
                  viewBox="0 0 24 24" 
                  fill={vote.hasUserLiked ? "#ef4444" : "none"}
                  stroke={vote.hasUserLiked ? "#ef4444" : "currentColor"}
                  strokeWidth={vote.hasUserLiked ? "2" : "1.5"}
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                  className={`transition-all duration-200 ${
                    vote.hasUserLiked ? 'scale-110' : 'hover:scale-105'
                  }`}
                >
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                </svg>
                <span className={`text-sm font-medium ${
                  vote.hasUserLiked ? 'text-red-500' : 'text-gray-400'
                }`}>
                  {vote.likesCount}
                </span>
              </button>
              
              <button 
                onClick={() => setIsCommentsOpen(!isCommentsOpen)}
                className="flex items-center space-x-1 text-gray-400 hover:text-ios-blue transition-colors"
                title="댓글"
              >
                <svg 
                  width="16" 
                  height="16" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                  className="w-4 h-4"
                >
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
                <span className="text-sm font-medium text-gray-400">
                  {vote.commentsCount}
                </span>
              </button>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-xs text-ios-gray">
                {getTimeRemaining(vote.endsAt)}
              </span>
            </div>
          </div>
        </div>

        {/* 댓글 섹션 */}
        {isCommentsOpen && (
          <div className="mt-4 pt-4 border-t border-gray-700">
            {/* 댓글 작성 */}
            <div className="mb-4">
              <div className="flex space-x-2">
                <Input
                  placeholder="댓글을 입력하세요..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onKeyPress={handleCommentKeyPress}
                  className="flex-1 bg-gray-800 border-gray-600 text-white placeholder-gray-400"
                />
                <Button
                  onClick={handleCommentSubmit}
                  disabled={!newComment.trim() || createCommentMutation.isPending}
                  className="bg-ios-blue hover:bg-ios-blue/90 text-white"
                >
                  {createCommentMutation.isPending ? "작성 중..." : "작성"}
                </Button>
              </div>
            </div>

            {/* 댓글 목록 */}
            <div className="space-y-3">
              {comments.length > 0 ? (
                <>
                  <div className="text-sm text-gray-300 border-b border-gray-600 pb-2">
                    댓글 {comments.length}개
                  </div>
                  <div className="space-y-3 max-h-60 overflow-y-auto">
                    {comments.map((comment) => (
                      <div key={comment.id} className="bg-gray-800 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <span className="text-sm font-medium text-white">
                              {(() => {
                                if (comment.user.firstName && comment.user.lastName) {
                                  return `${comment.user.firstName} ${comment.user.lastName}`;
                                }
                                return comment.user.email || "익명";
                              })()}
                            </span>
                            <span className="text-xs text-ios-gray">
                              {(() => {
                                if (!comment.createdAt) return "";
                                const now = new Date();
                                const commentDate = new Date(comment.createdAt);
                                const diffInSeconds = Math.floor((now.getTime() - commentDate.getTime()) / 1000);
                                
                                if (diffInSeconds < 60) return "방금 전";
                                if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}분 전`;
                                if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}시간 전`;
                                return commentDate.toLocaleDateString('ko-KR');
                              })()}
                            </span>
                          </div>
                          
                          {/* 본인이 작성한 댓글에만 삭제 버튼 표시 */}
                          {user && comment.userId === user.id && (
                            <button
                              onClick={() => handleDeleteComment(comment.id)}
                              disabled={deleteCommentMutation.isPending}
                              className="text-red-400 hover:text-red-300 transition-colors text-sm"
                              title="댓글 삭제"
                            >
                              <svg 
                                width="16" 
                                height="16" 
                                viewBox="0 0 24 24" 
                                fill="none" 
                                stroke="currentColor" 
                                strokeWidth="2" 
                                strokeLinecap="round" 
                                strokeLinejoin="round"
                              >
                                <polyline points="3,6 5,6 21,6"></polyline>
                                <path d="m19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"></path>
                                <line x1="10" y1="11" x2="10" y2="17"></line>
                                <line x1="14" y1="11" x2="14" y2="17"></line>
                              </svg>
                            </button>
                          )}
                        </div>
                        <p className="text-sm text-gray-300 leading-relaxed">
                          {comment.content}
                        </p>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-sm text-gray-400 text-center py-4">
                  첫 번째 댓글을 작성해보세요!
                </div>
              )}
            </div>
          </div>
        )}

      </CardContent>
    </Card>

      {/* 투표 수정 모달 */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="bg-ios-card border-gray-700 text-white">
          <DialogHeader>
            <DialogTitle className="text-white">투표 수정</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-ios-gray mb-2 block">투표 제목</label>
              <Input
                value={editQuestion}
                onChange={(e) => setEditQuestion(e.target.value)}
                placeholder="투표 제목을 입력하세요"
                className="bg-ios-bg border-gray-600 text-white placeholder-ios-gray"
              />
            </div>
            
            <div>
              <label className="text-sm text-ios-gray mb-2 block">선택지</label>
              <div className="space-y-2">
                {editOptions.map((option, index) => (
                  <div key={index} className="flex space-x-2">
                    <Input
                      value={option}
                      onChange={(e) => updateOption(index, e.target.value)}
                      placeholder={`선택지 ${index + 1}`}
                      className="flex-1 bg-ios-bg border-gray-600 text-white placeholder-ios-gray"
                    />
                    {editOptions.length > 2 && (
                      <Button
                        onClick={() => removeOption(index)}
                        variant="outline"
                        size="sm"
                        className="border-red-600 text-red-400 hover:bg-red-600 hover:text-white"
                      >
                        <i className="fas fa-times"></i>
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              
              {editOptions.length < 5 && (
                <Button
                  onClick={addOption}
                  variant="outline"
                  className="mt-2 w-full border-gray-600 text-gray-300 hover:bg-gray-700"
                >
                  <i className="fas fa-plus mr-2"></i>
                  선택지 추가
                </Button>
              )}
            </div>
            
            <div className="flex space-x-2 pt-4">
              <Button
                onClick={handleSaveEdit}
                disabled={updateVoteMutation.isPending}
                className="flex-1 bg-ios-blue hover:bg-ios-blue/90 text-white"
              >
                {updateVoteMutation.isPending ? "저장 중..." : "저장"}
              </Button>
              <Button
                onClick={() => setIsEditModalOpen(false)}
                variant="outline"
                className="border-gray-600 text-gray-300 hover:bg-gray-700"
              >
                취소
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 삭제 확인 다이얼로그 */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="bg-ios-card border-gray-700 text-white">
          <DialogHeader>
            <DialogTitle className="text-white">투표 삭제 확인</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-gray-300">
              정말로 이 투표를 삭제하시겠습니까?
            </p>
            <p className="text-sm text-red-400">
              삭제된 투표는 복구할 수 없습니다.
            </p>
            
            <div className="flex space-x-2 pt-4">
              <Button
                onClick={confirmDelete}
                disabled={deleteVoteMutation.isPending}
                variant="destructive"
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
              >
                {deleteVoteMutation.isPending ? "삭제 중..." : "삭제"}
              </Button>
              <Button
                onClick={() => setIsDeleteDialogOpen(false)}
                variant="outline"
                className="flex-1 border-gray-600 text-gray-300 hover:bg-gray-700"
              >
                취소
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
