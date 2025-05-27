import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import BottomNavigation from "@/components/BottomNavigation";
import { CommentWithVote, VoteWithDetails } from "@shared/schema";
import { useState } from "react";
import VoteCard from "@/components/VoteCard";

function formatTimeAgo(date: Date | string | null): string {
  if (!date) return "";
  
  const now = new Date();
  const commentDate = typeof date === 'string' ? new Date(date) : date;
  const diffInSeconds = Math.floor((now.getTime() - commentDate.getTime()) / 1000);
  
  if (diffInSeconds < 60) return "방금 전";
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}분 전`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}시간 전`;
  if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)}일 전`;
  
  return commentDate.toLocaleDateString('ko-KR');
}

export default function Messages() {
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState<'votes' | 'comments'>('votes');

  const { data: userComments = [], isLoading } = useQuery<CommentWithVote[]>({
    queryKey: ["/api/user/comments"],
    enabled: !!user,
  });

  // 댓글이 작성된 투표들을 중복 제거하여 추출
  const votesWithMyComments = userComments.reduce((votes, comment) => {
    const voteId = comment.vote.id;
    if (!votes.some(vote => vote.id === voteId)) {
      // CommentWithVote의 vote 정보를 VoteWithDetails 형태로 변환
      const voteWithDetails: VoteWithDetails = {
        id: comment.vote.id,
        question: comment.vote.question,
        creatorId: '', // 임시값
        regionId: comment.vote.region.id,
        createdAt: new Date(),
        endsAt: null,
        isActive: true,
        creator: comment.user,
        region: {
          ...comment.vote.region,
          createdAt: comment.vote.region.createdAt || new Date(),
        },
        options: [], // 빈 배열로 초기화
        totalVotes: 0,
        hasUserVoted: false,
        commentsCount: userComments.filter(c => c.vote.id === voteId).length,
        likesCount: 0,
        hasUserLiked: false,
      };
      votes.push(voteWithDetails);
    }
    return votes;
  }, [] as VoteWithDetails[]);

  if (!user) return null;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between p-4 pt-6 bg-ios-bg border-b border-gray-800">
        <h1 className="text-xl font-semibold">내 대화</h1>
        
        {/* 보기 모드 전환 버튼 */}
        <div className="flex bg-gray-800 rounded-lg p-1">
          <button
            onClick={() => setViewMode('votes')}
            className={`px-3 py-1 text-sm rounded transition-colors ${
              viewMode === 'votes' 
                ? 'bg-ios-blue text-white' 
                : 'text-ios-gray hover:text-white'
            }`}
          >
            투표
          </button>
          <button
            onClick={() => setViewMode('comments')}
            className={`px-3 py-1 text-sm rounded transition-colors ${
              viewMode === 'comments' 
                ? 'bg-ios-blue text-white' 
                : 'text-ios-gray hover:text-white'
            }`}
          >
            댓글
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pb-20">
        <div className="p-4">
          {isLoading ? (
            <div className="text-center py-12">
              <div className="text-ios-gray">댓글을 불러오는 중...</div>
            </div>
          ) : userComments.length === 0 ? (
            <div className="text-center py-12">
              <i className="far fa-comment-dots text-ios-gray text-4xl mb-4"></i>
              <h3 className="text-lg font-medium text-white mb-2">대화가 없습니다</h3>
              <p className="text-ios-gray text-sm">
                투표에 댓글을 달면 대화가 시작됩니다
              </p>
            </div>
          ) : viewMode === 'votes' ? (
            <div className="space-y-4">
              <h2 className="text-lg font-medium text-white mb-4">
                댓글을 작성한 투표 ({votesWithMyComments.length}개)
              </h2>
              
              {votesWithMyComments.map((vote) => (
                <div key={vote.id} className="mb-4">
                  <VoteCard vote={vote} />
                  
                  {/* 내가 작성한 댓글들 미리보기 */}
                  <div className="mt-2 ml-4 p-3 bg-gray-800 bg-opacity-50 rounded-lg border-l-2 border-ios-blue">
                    <div className="text-xs text-ios-gray mb-2">내가 작성한 댓글:</div>
                    {userComments
                      .filter(comment => comment.vote.id === vote.id)
                      .slice(0, 2) // 최대 2개만 미리보기
                      .map((comment) => (
                        <div key={comment.id} className="text-sm text-gray-300 mb-1">
                          "{comment.content}"
                        </div>
                      ))}
                    {userComments.filter(comment => comment.vote.id === vote.id).length > 2 && (
                      <div className="text-xs text-ios-gray">
                        외 {userComments.filter(comment => comment.vote.id === vote.id).length - 2}개 더...
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              <h2 className="text-lg font-medium text-white mb-4">
                내가 작성한 댓글 ({userComments.length}개)
              </h2>
              
              {userComments.map((comment) => (
                <div 
                  key={comment.id} 
                  className="bg-ios-card rounded-lg p-4 border border-gray-700"
                >
                  {/* 투표 정보 */}
                  <div className="mb-3 pb-3 border-b border-gray-600">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium text-white text-sm">
                        {comment.vote.question}
                      </h3>
                      <span className="text-xs text-ios-gray bg-gray-600 bg-opacity-30 px-2 py-1 rounded">
                        {comment.vote.region.name}
                      </span>
                    </div>
                  </div>
                  
                  {/* 댓글 내용 */}
                  <div className="mb-2">
                    <p className="text-white text-sm leading-relaxed">
                      {comment.content}
                    </p>
                  </div>
                  
                  {/* 댓글 작성 시간 */}
                  <div className="text-xs text-ios-gray">
                    {formatTimeAgo(comment.createdAt)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Bottom Navigation */}
      <BottomNavigation currentPage="messages" />
    </div>
  );
}
