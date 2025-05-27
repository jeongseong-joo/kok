import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { VoteWithDetails, Region } from "@shared/schema";
import VoteCard from "@/components/VoteCard";
import RegionSelector from "@/components/RegionSelector";
import CreateVoteModal from "@/components/CreateVoteModal";
import BottomNavigation from "@/components/BottomNavigation";
import { Search, Filter } from "lucide-react";

export default function Home() {
  const { user } = useAuth();
  const [location, setLocation] = useLocation();
  const [isRegionModalOpen, setIsRegionModalOpen] = useState(false);
  const [isCreateVoteModalOpen, setIsCreateVoteModalOpen] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState<Region | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<'participants' | 'newest' | 'oldest'>('participants');
  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);

  // URL에서 공유된 투표 ID 확인
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const voteId = urlParams.get('vote');
    
    if (voteId) {
      // URL에서 파라미터 제거 (깔끔한 URL 유지)
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);
      
      // 투표 카드로 스크롤 (약간의 지연 후 - 데이터 로딩 대기)
      setTimeout(() => {
        const voteElement = document.getElementById(`vote-${voteId}`);
        if (voteElement) {
          voteElement.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'center' 
          });
          // 하이라이트 효과
          voteElement.style.animation = 'pulse 2s ease-in-out';
        }
      }, 1000);
    }
  }, []);

  // Fetch all regions
  const { data: regions = [] } = useQuery<Region[]>({
    queryKey: ["/api/regions"],
  });

  // Fetch user's selected region
  const { data: userSelectedRegion } = useQuery<Region>({
    queryKey: ["/api/user/selected-region"],
    enabled: !!user,
  });

  // Fetch votes for selected region (홈에서는 검색 없이 모든 투표 표시)
  const { data: votes = [], isLoading: votesLoading, refetch: refetchVotes } = useQuery<VoteWithDetails[]>({
    queryKey: ["/api/votes", selectedRegion?.id, sortBy],
    queryFn: async () => {
      if (!selectedRegion?.id) return [];
      const params = new URLSearchParams({
        regionId: selectedRegion.id.toString(),
        sortBy: sortBy
      });
      const response = await fetch(`/api/votes?${params}`);
      if (!response.ok) throw new Error('Failed to fetch votes');
      return response.json();
    },
    enabled: !!selectedRegion?.id,
  });

  useEffect(() => {
    if (userSelectedRegion) {
      setSelectedRegion(userSelectedRegion);
    } else if (regions.length > 0 && !selectedRegion) {
      // Default to "대한민국" if no region is selected
      const countryRegion = regions.find(r => r.level === "country");
      if (countryRegion) {
        setSelectedRegion(countryRegion);
      }
    }
  }, [userSelectedRegion, regions, selectedRegion]);

  // 정렬 드롭다운 외부 클릭 감지
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isSortMenuOpen) {
        const target = event.target as Element;
        if (!target.closest('[data-sort-menu]')) {
          setIsSortMenuOpen(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isSortMenuOpen]);

  const handleRegionChange = (region: Region) => {
    setSelectedRegion(region);
    setIsRegionModalOpen(false);
  };

  // 검색 실행 함수
  const handleSearch = () => {
    if (searchQuery.trim() && selectedRegion) {
      const params = new URLSearchParams({
        q: searchQuery.trim(),
        regionId: selectedRegion.id.toString(),
        sortBy: sortBy
      });
      setLocation(`/search?${params}`);
    }
  };

  // Enter 키 검색 처리
  const handleSearchKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen flex flex-col relative">
      {/* Header */}
      <header className="flex items-center justify-between p-4 pt-6 bg-ios-bg border-b border-gray-800">
        <Button
          onClick={() => setIsRegionModalOpen(true)}
          variant="outline"
          className="bg-ios-card border-gray-700 text-ios-gray hover:bg-gray-700 rounded-full px-3 py-2"
        >
          <i className="fas fa-map-marker-alt text-ios-blue text-sm mr-2"></i>
          <span className="text-sm">
            {selectedRegion?.name || "지역 선택"}
          </span>
          <i className="fas fa-chevron-down text-ios-gray text-xs ml-2"></i>
        </Button>
        
        <div className="flex items-center space-x-3">
          {/* 검색 버튼 */}
          <button
            onClick={() => setIsSearchOpen(!isSearchOpen)}
            className="p-2 text-white hover:text-ios-blue transition-colors"
            title="투표 검색"
          >
            <Search className="w-6 h-6" />
          </button>
          
          {/* 정렬 버튼 */}
          <div className="relative" data-sort-menu>
            <button
              onClick={() => setIsSortMenuOpen(!isSortMenuOpen)}
              className="p-2 text-white hover:text-ios-blue transition-colors"
              title="투표 정렬"
            >
              <svg 
                width="24" 
                height="24" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
                className="w-6 h-6"
              >
                <line x1="3" y1="6" x2="21" y2="6"/>
                <line x1="3" y1="12" x2="21" y2="12"/>
                <line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            </button>
            
            {/* 정렬 드롭다운 메뉴 */}
            {isSortMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-40 bg-gray-800 border border-gray-600 rounded-lg shadow-xl z-50">
                <div className="p-1">
                  <button
                    onClick={() => {
                      setSortBy('participants');
                      setIsSortMenuOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-sm rounded-md transition-colors flex items-center ${
                      sortBy === 'participants' 
                        ? 'bg-ios-blue text-white' 
                        : 'text-gray-300 hover:bg-gray-700'
                    }`}
                  >
                    참여자 많은 순
                  </button>
                  <button
                    onClick={() => {
                      setSortBy('newest');
                      setIsSortMenuOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-sm rounded-md transition-colors flex items-center ${
                      sortBy === 'newest' 
                        ? 'bg-ios-blue text-white' 
                        : 'text-gray-300 hover:bg-gray-700'
                    }`}
                  >
                    최신순
                  </button>
                  <button
                    onClick={() => {
                      setSortBy('oldest');
                      setIsSortMenuOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-sm rounded-md transition-colors flex items-center ${
                      sortBy === 'oldest' 
                        ? 'bg-ios-blue text-white' 
                        : 'text-gray-300 hover:bg-gray-700'
                    }`}
                  >
                    오래된 순
                  </button>
                </div>
              </div>
            )}
          </div>
          
          {/* 알림 버튼 */}
          <button
            onClick={() => {/* TODO: 키워드 알림 설정 모달 열기 */}}
            className="relative p-2 text-white hover:text-ios-blue transition-colors"
            title="키워드 알림 설정"
          >
            <svg 
              width="24" 
              height="24" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="1.5" 
              strokeLinecap="round" 
              strokeLinejoin="round"
              className="w-6 h-6"
            >
              <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/>
              <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>
            </svg>
            {/* 알림 개수 배지 (예시) */}
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-medium">
              3
            </span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pb-20">
        {/* 검색 섹션 */}
        {isSearchOpen && (
          <div className="p-4 bg-gray-800 border-b border-gray-700">
            <div className="flex space-x-2">
              <Input
                placeholder="투표 검색... (Enter로 검색)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={handleSearchKeyPress}
                className="bg-gray-700 border-gray-600 text-white placeholder-gray-400 flex-1"
              />
              <Button
                onClick={handleSearch}
                disabled={!searchQuery.trim()}
                className="bg-ios-blue hover:bg-ios-blue/90 text-white rounded-lg px-4"
              >
                검색
              </Button>
            </div>
          </div>
        )}
        
        <div className="p-3 space-y-0">
          {!selectedRegion ? (
            <div className="text-center py-12">
              <i className="fas fa-map-marker-alt text-ios-gray text-4xl mb-4"></i>
              <h3 className="text-lg font-medium text-white mb-2">지역을 선택해주세요</h3>
              <p className="text-ios-gray text-sm mb-6">
                우상단의 지역 버튼을 눌러 관심 지역을 설정하세요
              </p>
              <Button
                onClick={() => setIsRegionModalOpen(true)}
                className="bg-ios-blue hover:bg-ios-blue/90 text-white rounded-xl"
              >
                지역 선택하기
              </Button>
            </div>
          ) : votesLoading ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 border-2 border-ios-blue border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
              <p className="text-ios-gray text-sm">투표 불러오는 중...</p>
            </div>
          ) : votes.length === 0 ? (
            <div className="text-center py-12">
              <i className="fas fa-vote-yea text-ios-gray text-4xl mb-4"></i>
              <h3 className="text-lg font-medium text-white mb-2">
                {selectedRegion.name}에 진행중인 투표가 없습니다
              </h3>
              <p className="text-ios-gray text-sm mb-6">
                첫 번째 투표를 만들어보세요!
              </p>
              <Button
                onClick={() => setIsCreateVoteModalOpen(true)}
                className="bg-ios-blue hover:bg-ios-blue/90 text-white rounded-xl"
              >
                투표 만들기
              </Button>
            </div>
          ) : (
            (() => {
              // 투표를 진행 중과 종료된 투표로 분리
              const activeVotes = votes.filter(vote => {
                if (!vote.endsAt) return true; // 기간 없는 투표는 진행중
                const endDate = new Date(vote.endsAt);
                return endDate.getTime() > Date.now();
              });
              
              const endedVotes = votes.filter(vote => {
                if (!vote.endsAt) return false; // 기간 없는 투표는 진행중
                const endDate = new Date(vote.endsAt);
                return endDate.getTime() <= Date.now();
              });
              
              // 진행 중 투표는 참여자순, 종료된 투표는 종료된 순서대로 정렬
              const sortedActiveVotes = [...activeVotes].sort((a, b) => b.totalVotes - a.totalVotes);
              const sortedEndedVotes = [...endedVotes].sort((a, b) => {
                const aEndTime = new Date(a.endsAt || 0).getTime();
                const bEndTime = new Date(b.endsAt || 0).getTime();
                return bEndTime - aEndTime; // 최근 종료된 순
              });
              
              return [
                // 진행 중인 투표 먼저 표시 (HOT 배지 포함)
                ...sortedActiveVotes.map((vote, index) => {
                  const isHot = index < 3 && vote.totalVotes > 0; // 진행중 투표만 HOT
                  
                  return (
                    <div key={vote.id} id={`vote-${vote.id}`}>
                      <VoteCard 
                        vote={vote} 
                        onVoteSuccess={() => refetchVotes()} 
                        isHot={isHot}
                      />
                    </div>
                  );
                }),
                // 종료된 투표 하단에 표시 (HOT 배지 없음)
                ...sortedEndedVotes.map((vote) => (
                  <div key={vote.id} id={`vote-${vote.id}`}>
                    <VoteCard 
                      vote={vote} 
                      onVoteSuccess={() => refetchVotes()} 
                      isHot={false}
                    />
                  </div>
                ))
              ];
            })()
          )}
        </div>
      </main>

      {/* Floating Action Button */}
      {selectedRegion && (
        <Button
          onClick={() => setIsCreateVoteModalOpen(true)}
          className="fixed bottom-24 right-4 w-14 h-14 bg-ios-orange hover:bg-ios-orange/90 rounded-full shadow-lg z-30 text-white text-2xl font-light"
        >
          +
        </Button>
      )}

      {/* Bottom Navigation */}
      <BottomNavigation currentPage="home" />

      {/* Modals */}
      <RegionSelector
        isOpen={isRegionModalOpen}
        onClose={() => setIsRegionModalOpen(false)}
        onSelect={handleRegionChange}
        selectedRegion={selectedRegion}
      />

      <CreateVoteModal
        isOpen={isCreateVoteModalOpen}
        onClose={() => setIsCreateVoteModalOpen(false)}
        selectedRegion={selectedRegion}
        onSuccess={() => {
          setIsCreateVoteModalOpen(false);
          refetchVotes();
        }}
      />
    </div>
  );
}
