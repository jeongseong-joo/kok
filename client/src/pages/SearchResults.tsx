import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Home, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import VoteCard from "@/components/VoteCard";
import BottomNavigation from "@/components/BottomNavigation";
import { useAuth } from "@/hooks/useAuth";
import type { VoteWithDetails, Region } from "@shared/schema";

export default function SearchResults() {
  const { user } = useAuth();
  const [location, setLocation] = useLocation();
  const [isNewSearchOpen, setIsNewSearchOpen] = useState(false);
  const [newSearchQuery, setNewSearchQuery] = useState("");
  
  // URL에서 검색어와 지역 ID 가져오기
  const urlParams = new URLSearchParams(window.location.search);
  const searchQuery = urlParams.get('q') || '';
  const regionId = parseInt(urlParams.get('regionId') || '0');
  const sortBy = urlParams.get('sortBy') as 'participants' | 'newest' | 'oldest' || 'participants';

  // 선택된 지역 정보 가져오기
  const { data: regions = [] } = useQuery<Region[]>({
    queryKey: ["/api/regions"],
  });

  const selectedRegion = regions.find(r => r.id === regionId);

  // 모든 투표 가져오기
  const { data: allVotes = [], isLoading: votesLoading, refetch: refetchVotes } = useQuery<VoteWithDetails[]>({
    queryKey: ["/api/votes", regionId, sortBy],
    queryFn: async () => {
      if (!regionId) return [];
      const params = new URLSearchParams({
        regionId: regionId.toString(),
        sortBy: sortBy
      });
      const response = await fetch(`/api/votes?${params}`);
      if (!response.ok) throw new Error('Failed to fetch votes');
      return response.json();
    },
    enabled: !!regionId,
  });

  // 클라이언트에서 검색 필터링 수행
  const searchResults = allVotes.filter(vote => {
    if (!searchQuery.trim()) return false;
    
    const searchTerm = searchQuery.toLowerCase();
    const questionMatch = vote.question.toLowerCase().includes(searchTerm);
    const optionMatch = vote.options.some(option => 
      option.text.toLowerCase().includes(searchTerm)
    );
    
    return questionMatch || optionMatch;
  });

  const searchLoading = votesLoading;

  // 새로운 검색 실행 함수
  const handleNewSearch = () => {
    if (newSearchQuery.trim() && regionId) {
      const params = new URLSearchParams({
        q: newSearchQuery.trim(),
        regionId: regionId.toString(),
        sortBy: sortBy
      });
      setLocation(`/search?${params}`);
      setIsNewSearchOpen(false);
      setNewSearchQuery("");
    }
  };

  // Enter 키 검색 처리
  const handleSearchKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleNewSearch();
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* Header */}
      <header className="bg-gray-900 px-4 py-3 flex items-center justify-between border-b border-gray-800">
        <div className="flex items-center space-x-3">
          {/* 뒤로가기 버튼 */}
          <button
            onClick={() => setLocation('/')}
            className="p-2 text-white hover:text-ios-blue transition-colors"
            title="뒤로가기"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          
          <div>
            <h1 className="text-lg font-semibold">검색 결과</h1>
            <p className="text-sm text-ios-gray">
              {selectedRegion ? `${selectedRegion.name}에서 검색` : ''}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {/* 검색어 표시 */}
          <div className="flex items-center bg-gray-800 rounded-lg px-3 py-1 space-x-2">
            <span className="text-white text-sm">{searchQuery}</span>
            <button
              onClick={() => setIsNewSearchOpen(true)}
              className="text-gray-400 hover:text-white transition-colors"
              title="새로 검색"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* 홈 버튼 */}
          <button
            onClick={() => setLocation('/')}
            className="p-2 text-white hover:text-ios-blue transition-colors"
            title="홈으로"
          >
            <Home className="w-6 h-6" />
          </button>
        </div>
      </header>

      {/* 새로운 검색 섹션 */}
      {isNewSearchOpen && (
        <div className="p-4 bg-gray-800 border-b border-gray-700">
          <div className="flex space-x-2">
            <Input
              placeholder="새로운 검색어를 입력하세요..."
              value={newSearchQuery}
              onChange={(e) => setNewSearchQuery(e.target.value)}
              onKeyPress={handleSearchKeyPress}
              className="bg-gray-700 border-gray-600 text-white placeholder-gray-400 flex-1"
              autoFocus
            />
            <Button
              onClick={handleNewSearch}
              disabled={!newSearchQuery.trim()}
              className="bg-ios-blue hover:bg-ios-blue/90 text-white rounded-lg px-4"
            >
              검색
            </Button>
            <Button
              onClick={() => {
                setIsNewSearchOpen(false);
                setNewSearchQuery("");
              }}
              variant="outline"
              className="border-gray-600 text-gray-300 hover:bg-gray-700 rounded-lg px-4"
            >
              취소
            </Button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pb-20">
        <div className="p-4 space-y-4">
          {!searchQuery.trim() ? (
            <div className="text-center py-12">
              <div className="text-ios-gray text-4xl mb-4">🔍</div>
              <h3 className="text-lg font-medium text-white mb-2">검색어를 입력해주세요</h3>
              <p className="text-ios-gray text-sm mb-6">
                찾고 싶은 투표 키워드를 입력하세요
              </p>
              <Button
                onClick={() => setLocation('/')}
                className="bg-ios-blue hover:bg-ios-blue/90 text-white rounded-xl"
              >
                홈으로 돌아가기
              </Button>
            </div>
          ) : searchLoading ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 border-2 border-ios-blue border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
              <p className="text-ios-gray text-sm">검색 중...</p>
            </div>
          ) : searchResults.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-ios-gray text-4xl mb-4">😕</div>
              <h3 className="text-lg font-medium text-white mb-2">
                "{searchQuery}"에 대한 검색 결과가 없습니다
              </h3>
              <p className="text-ios-gray text-sm mb-6">
                다른 키워드로 검색해보거나 새로운 투표를 만들어보세요
              </p>
              <div className="space-x-3">
                <Button
                  onClick={() => setLocation('/')}
                  variant="outline"
                  className="border-gray-600 text-white hover:bg-gray-800 rounded-xl"
                >
                  홈으로 돌아가기
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4">
                <p className="text-ios-gray text-sm">
                  총 {searchResults.length}개의 투표를 찾았습니다
                </p>
              </div>
              
              {searchResults.map((vote) => (
                <VoteCard 
                  key={vote.id} 
                  vote={vote} 
                  onVoteSuccess={() => refetchVotes()} 
                />
              ))}
            </>
          )}
        </div>
      </main>

      {/* Bottom Navigation */}
      <BottomNavigation currentPage="home" />
    </div>
  );
}