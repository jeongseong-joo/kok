import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import BottomNavigation from "@/components/BottomNavigation";

export default function Settings() {
  const { user } = useAuth();
  const [keywords, setKeywords] = useState<string[]>([]);
  const [newKeyword, setNewKeyword] = useState('');
  const [isNicknameModalOpen, setIsNicknameModalOpen] = useState(false);
  const [nickname, setNickname] = useState('');
  const [displayName, setDisplayName] = useState('id'); // "id" or "nickname"
  const [currentNickname, setCurrentNickname] = useState('');
  const [customProfileImage, setCustomProfileImage] = useState<string | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [profileType, setProfileType] = useState<'image' | 'initial'>('image'); // "image" or "initial"
  
  // 정보 모달 상태
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showAppInfoModal, setShowAppInfoModal] = useState(false);

  // 설정 로드
  useEffect(() => {
    if (user?.id) {
      const savedSettings = localStorage.getItem(`userSettings_${user.id}`);
      if (savedSettings) {
        const settings = JSON.parse(savedSettings);
        setKeywords(settings.keywords || []);
        setDisplayName(settings.displayName || 'id');
        setCurrentNickname(settings.currentNickname || '');
        setCustomProfileImage(settings.customProfileImage || null);
        setProfileType(settings.profileType || 'image');
      } else {
        // 기본 키워드 설정
        setKeywords(['선거', '개발', '맛집']);
      }
    }
  }, [user?.id]);

  const handleLogout = () => {
    window.location.href = "/api/logout";
  };

  const addKeyword = () => {
    if (newKeyword.trim() && !keywords.includes(newKeyword.trim())) {
      setKeywords([...keywords, newKeyword.trim()]);
      setNewKeyword('');
    }
  };

  const removeKeyword = (keyword: string) => {
    setKeywords(keywords.filter(k => k !== keyword));
  };

  const handleNicknameSave = () => {
    if (nickname.trim()) {
      setCurrentNickname(nickname.trim());
      setDisplayName('nickname');
      setIsNicknameModalOpen(false);
      setNickname('');
    }
  };

  const getDisplayedName = () => {
    if (displayName === 'nickname' && currentNickname) {
      return currentNickname;
    }
    return user?.firstName && user?.lastName 
      ? `${user.firstName} ${user.lastName}`
      : user?.email?.split('@')[0] || '사용자';
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setCustomProfileImage(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const getCurrentProfileImage = () => {
    return customProfileImage || user?.profileImageUrl;
  };

  const getInitials = () => {
    const name = displayName === 'nickname' && currentNickname 
      ? currentNickname 
      : user?.email?.split('@')[0] || '사용자';
    
    if (name.length >= 2) {
      return name.substring(0, 2).toUpperCase();
    }
    return name.substring(0, 1).toUpperCase();
  };

  const handleCameraCapture = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment';
    input.onchange = handleImageUpload;
    input.click();
    setIsProfileModalOpen(false);
  };

  const handleGallerySelect = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = handleImageUpload;
    input.click();
    setIsProfileModalOpen(false);
  };

  const handleInitialAvatar = () => {
    setProfileType('initial');
    setCustomProfileImage(null);
    setIsProfileModalOpen(false);
  };

  // 설정 저장
  const saveSettings = () => {
    if (user?.id) {
      const settings = {
        keywords,
        displayName,
        currentNickname,
        customProfileImage,
        profileType,
        savedAt: new Date().toISOString()
      };
      localStorage.setItem(`userSettings_${user.id}`, JSON.stringify(settings));
      alert('설정이 저장되었습니다!');
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between p-4 pt-6 bg-ios-bg border-b border-gray-800">
        <h1 className="text-xl font-semibold">설정</h1>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pb-20">
        <div className="p-4 space-y-4">
          {/* Profile Card */}
          <Card className="bg-ios-card border-gray-700">
            <CardContent className="p-4">
              <div className="flex items-center space-x-4">
                <div className="relative">
                  <button
                    onClick={() => setIsProfileModalOpen(true)}
                    className="cursor-pointer group relative block"
                  >
                    {profileType === 'initial' ? (
                      <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-full flex items-center justify-center group-hover:from-emerald-400 group-hover:to-teal-500 transition-all border-2 border-emerald-400/30">
                        <span className="text-white text-lg font-bold">{getInitials()}</span>
                      </div>
                    ) : getCurrentProfileImage() ? (
                      <img 
                        src={getCurrentProfileImage()} 
                        alt="Profile" 
                        className="w-16 h-16 rounded-full object-cover border-2 border-gray-600 group-hover:border-ios-blue transition-colors"
                      />
                    ) : (
                      <div className="w-16 h-16 bg-ios-blue rounded-full flex items-center justify-center group-hover:bg-ios-blue/80 transition-colors">
                        <i className="fas fa-user text-white text-xl"></i>
                      </div>
                    )}
                    <div className="absolute inset-0 rounded-full bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all flex items-center justify-center">
                      <i className="fas fa-camera text-white text-sm opacity-0 group-hover:opacity-100 transition-opacity"></i>
                    </div>
                  </button>
                </div>
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-1">
                    <h3 className="text-lg font-medium text-white">
                      {getDisplayedName()}
                    </h3>
                    <Button
                      variant="outline"
                      size="sm"
                      className="bg-transparent border-ios-blue text-ios-blue hover:bg-ios-blue hover:text-white text-xs px-2 py-1 h-6"
                      onClick={() => setIsNicknameModalOpen(true)}
                    >
                      별명사용
                    </Button>
                  </div>
                  {displayName === 'nickname' && currentNickname && (
                    <div className="flex items-center space-x-2 mb-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs text-ios-gray hover:text-white px-1 py-0 h-auto"
                        onClick={() => setDisplayName('id')}
                      >
                        아이디로 표시
                      </Button>
                    </div>
                  )}
                  {user?.email && (
                    <p className="text-ios-gray text-sm">{user.email}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Keyword Notification Settings */}
          <Card className="bg-ios-card border-gray-700">
            <CardContent className="p-4">
              <div className="flex items-center space-x-3 mb-4">
                <i className="fas fa-bell text-ios-blue"></i>
                <h3 className="text-white font-medium">키워드 알림</h3>
              </div>
              
              <div className="space-y-3">
                <div className="flex space-x-2">
                  <Input
                    value={newKeyword}
                    onChange={(e) => setNewKeyword(e.target.value)}
                    placeholder="관심 키워드 입력"
                    className="flex-1 bg-ios-bg border-gray-600 text-white placeholder-ios-gray"
                    onKeyPress={(e) => e.key === 'Enter' && addKeyword()}
                  />
                  <Button
                    onClick={addKeyword}
                    className="bg-ios-blue hover:bg-ios-blue/90 text-white"
                  >
                    추가
                  </Button>
                </div>
                
                <div className="flex flex-wrap gap-2">
                  {keywords.map((keyword) => (
                    <Badge
                      key={keyword}
                      variant="secondary"
                      className="bg-gray-600 bg-opacity-20 text-gray-300 border border-gray-600 border-opacity-30 hover:bg-ios-blue hover:text-white cursor-pointer transition-colors"
                      onClick={() => removeKeyword(keyword)}
                    >
                      {keyword}
                      <i className="fas fa-times ml-1 text-xs"></i>
                    </Badge>
                  ))}
                </div>
                
                <p className="text-xs text-ios-gray">
                  설정한 키워드가 포함된 투표가 생성되면 알림을 받습니다.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Settings Options */}
          <div className="space-y-2">

            <Card className="bg-ios-card border-gray-700">
              <CardContent className="p-0">
                <button 
                  onClick={() => setShowPrivacyModal(true)}
                  className="w-full p-4 text-left flex items-center justify-between hover:bg-gray-700 transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <i className="fas fa-shield-alt text-ios-blue"></i>
                    <span className="text-white">개인정보 보호</span>
                  </div>
                  <i className="fas fa-chevron-right text-ios-gray"></i>
                </button>
              </CardContent>
            </Card>

            <Card className="bg-ios-card border-gray-700">
              <CardContent className="p-0">
                <button 
                  onClick={() => setShowHelpModal(true)}
                  className="w-full p-4 text-left flex items-center justify-between hover:bg-gray-700 transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <i className="fas fa-question-circle text-ios-blue"></i>
                    <span className="text-white">도움말</span>
                  </div>
                  <i className="fas fa-chevron-right text-ios-gray"></i>
                </button>
              </CardContent>
            </Card>

            <Card className="bg-ios-card border-gray-700">
              <CardContent className="p-0">
                <button 
                  onClick={() => setShowAppInfoModal(true)}
                  className="w-full p-4 text-left flex items-center justify-between hover:bg-gray-700 transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <i className="fas fa-info-circle text-ios-blue"></i>
                    <span className="text-white">앱 정보</span>
                  </div>
                  <i className="fas fa-chevron-right text-ios-gray"></i>
                </button>
              </CardContent>
            </Card>
          </div>

          {/* Settings Complete Button */}
          <Card className="bg-ios-card border-gray-700 mt-6">
            <CardContent className="p-4">
              <Button
                onClick={saveSettings}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium"
              >
                <i className="fas fa-check mr-2"></i>
                설정 완료
              </Button>
            </CardContent>
          </Card>

          {/* Logout Button */}
          <Card className="bg-ios-card border-gray-700 mt-4">
            <CardContent className="p-4">
              <Button
                onClick={handleLogout}
                variant="destructive"
                className="w-full bg-ios-red hover:bg-ios-red/90 text-white rounded-xl"
              >
                로그아웃
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Bottom Navigation */}
      <BottomNavigation currentPage="settings" />

      {/* 개인정보보호 모달 */}
      <Dialog open={showPrivacyModal} onOpenChange={setShowPrivacyModal}>
        <DialogContent className="bg-ios-card border-gray-700 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">개인정보보호</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm text-gray-300 leading-relaxed">
            <p>
              <strong className="text-white">개인정보 수집 및 이용</strong><br/>
              콕 앱은 서비스 제공을 위해 최소한의 개인정보만을 수집합니다.
            </p>
            <p>
              <strong className="text-white">수집 정보</strong><br/>
              • 로그인 정보 (이메일, 프로필 사진)<br/>
              • 투표 참여 기록<br/>
              • 댓글 및 좋아요 활동
            </p>
            <p>
              <strong className="text-white">정보 보호</strong><br/>
              모든 개인정보는 암호화되어 안전하게 보관되며, 제3자에게 제공되지 않습니다.
            </p>
            <p>
              <strong className="text-white">정보 삭제</strong><br/>
              계정 탈퇴 시 모든 개인정보가 즉시 삭제됩니다.
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* 도움말 모달 */}
      <Dialog open={showHelpModal} onOpenChange={setShowHelpModal}>
        <DialogContent className="bg-ios-card border-gray-700 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">도움말</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm text-gray-300 leading-relaxed">
            <p>
              <strong className="text-white">콕 앱 사용법</strong><br/>
              지역 기반 투표 플랫폼 콕에 오신 것을 환영합니다!
            </p>
            <p>
              <strong className="text-white">투표 참여하기</strong><br/>
              • 홈 화면에서 관심 있는 투표를 찾아보세요<br/>
              • 옵션을 터치하면 즉시 투표됩니다<br/>
              • 투표 결과는 실시간으로 업데이트됩니다
            </p>
            <p>
              <strong className="text-white">투표 만들기</strong><br/>
              • 오른쪽 하단의 주황색 + 버튼을 눌러보세요<br/>
              • 질문과 선택지를 입력하고 지역을 설정하세요<br/>
              • 투표 기간을 설정할 수 있습니다
            </p>
            <p>
              <strong className="text-white">소통하기</strong><br/>
              • 투표에 댓글을 남겨 의견을 나누세요<br/>
              • 좋아요로 관심을 표현하세요<br/>
              • 카카오톡이나 메시지로 투표를 공유하세요
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* 앱 정보 모달 */}
      <Dialog open={showAppInfoModal} onOpenChange={setShowAppInfoModal}>
        <DialogContent className="bg-ios-card border-gray-700 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">앱 정보</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm text-gray-300 leading-relaxed">
            <p>
              <strong className="text-white">콕 (Kok) v1.0</strong><br/>
              지역 기반 투표 플랫폼
            </p>
            <p>
              <strong className="text-white text-red-400">⚠️ 이용 수칙</strong><br/>
              콕 앱은 건전한 소통과 민주적 참여를 위한 플랫폼입니다.
            </p>
            <p>
              <strong className="text-white">금지 행위</strong><br/>
              • 개인의 권리침해 및 인신공격<br/>
              • 악의적인 목적의 투표 생성<br/>
              • 정치적 목적의 선거법 위반 행위<br/>
              • 허위 정보 유포 및 스팸 활동
            </p>
            <p>
              <strong className="text-white">책임 및 제재</strong><br/>
              • 모든 게시물의 책임은 작성자에게 있습니다<br/>
              • 부적절한 내용은 관리자가 강제 블라인드 처리할 수 있습니다<br/>
              • 반복적인 위반 시 계정이 제재될 수 있습니다
            </p>
            <p>
              <strong className="text-white">문의</strong><br/>
              서비스 관련 문의사항이 있으시면 설정에서 고객센터를 이용해주세요.
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Nickname Modal */}
      <Dialog open={isNicknameModalOpen} onOpenChange={setIsNicknameModalOpen}>
        <DialogContent className="bg-ios-card border-gray-700 text-white">
          <DialogHeader>
            <DialogTitle className="text-white">별명 설정</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-ios-gray mb-2 block">새 별명</label>
              <Input
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="사용할 별명을 입력하세요"
                className="bg-ios-bg border-gray-600 text-white placeholder-ios-gray"
                onKeyPress={(e) => e.key === 'Enter' && handleNicknameSave()}
              />
            </div>
            <div className="flex space-x-2">
              <Button
                onClick={handleNicknameSave}
                disabled={!nickname.trim()}
                className="flex-1 bg-ios-blue hover:bg-ios-blue/90 text-white"
              >
                저장
              </Button>
              <Button
                onClick={() => {
                  setIsNicknameModalOpen(false);
                  setNickname('');
                }}
                variant="outline"
                className="flex-1 border-gray-600 text-gray-300 hover:bg-gray-700"
              >
                취소
              </Button>
            </div>
            {currentNickname && (
              <div className="pt-2 border-t border-gray-700">
                <p className="text-xs text-ios-gray mb-2">현재 별명: {currentNickname}</p>
                <div className="flex space-x-2">
                  <Button
                    onClick={() => setDisplayName('nickname')}
                    variant={displayName === 'nickname' ? 'default' : 'outline'}
                    size="sm"
                    className={displayName === 'nickname' 
                      ? 'bg-ios-blue text-white text-xs' 
                      : 'border-gray-600 text-gray-300 hover:bg-gray-700 text-xs'
                    }
                  >
                    별명 표시
                  </Button>
                  <Button
                    onClick={() => setDisplayName('id')}
                    variant={displayName === 'id' ? 'default' : 'outline'}
                    size="sm"
                    className={displayName === 'id' 
                      ? 'bg-ios-blue text-white text-xs' 
                      : 'border-gray-600 text-gray-300 hover:bg-gray-700 text-xs'
                    }
                  >
                    아이디 표시
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Profile Picture Modal */}
      <Dialog open={isProfileModalOpen} onOpenChange={setIsProfileModalOpen}>
        <DialogContent className="bg-ios-card border-gray-700 text-white">
          <DialogHeader>
            <DialogTitle className="text-white">프로필 사진 설정</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3">
              <Button
                onClick={handleCameraCapture}
                variant="outline"
                className="flex items-center justify-start space-x-3 p-4 h-auto border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white"
              >
                <i className="fas fa-camera text-ios-blue text-lg"></i>
                <div className="text-left">
                  <div className="font-medium">카메라로 촬영</div>
                  <div className="text-xs text-ios-gray">새 사진을 촬영합니다</div>
                </div>
              </Button>
              
              <Button
                onClick={handleGallerySelect}
                variant="outline"
                className="flex items-center justify-start space-x-3 p-4 h-auto border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white"
              >
                <i className="fas fa-images text-ios-blue text-lg"></i>
                <div className="text-left">
                  <div className="font-medium">갤러리에서 선택</div>
                  <div className="text-xs text-ios-gray">저장된 사진을 선택합니다</div>
                </div>
              </Button>
              
              <Button
                onClick={handleInitialAvatar}
                variant="outline"
                className="flex items-center justify-start space-x-3 p-4 h-auto border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white"
              >
                <div className="w-6 h-6 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-full flex items-center justify-center border border-emerald-400/30">
                  <span className="text-white text-xs font-bold">{getInitials()}</span>
                </div>
                <div className="text-left">
                  <div className="font-medium">초성 아바타</div>
                  <div className="text-xs text-ios-gray">이름 초성으로 아바타를 만듭니다</div>
                </div>
              </Button>
            </div>
            
            <Button
              onClick={() => setIsProfileModalOpen(false)}
              variant="outline"
              className="w-full border-gray-600 text-gray-300 hover:bg-gray-700"
            >
              취소
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
