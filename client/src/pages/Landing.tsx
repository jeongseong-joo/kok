import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function Landing() {
  const handleLogin = () => {
    window.location.href = "/api/login";
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-ios-bg via-ios-card to-ios-bg">
      <Card className="w-full max-w-md bg-ios-card border-gray-700 shadow-ios-lg">
        <CardContent className="pt-8 pb-8 px-6 text-center">
          <div className="w-20 h-20 bg-ios-blue rounded-full flex items-center justify-center mx-auto mb-6">
            <i className="fas fa-vote-yea text-white text-2xl"></i>
          </div>
          
          <h1 className="text-3xl font-bold mb-4 text-white">콕</h1>
          <p className="text-ios-gray mb-8 leading-relaxed">
            지역 기반 투표 플랫폼에 오신 것을 환영합니다. 
            우리 동네의 목소리를 들어보세요.
          </p>
          
          <div className="space-y-3">
            <Button 
              onClick={handleLogin}
              className="w-full bg-ios-blue hover:bg-ios-blue/90 text-white py-3 text-lg font-medium rounded-xl transition-all duration-200 shadow-lg"
            >
              <i className="fab fa-replit mr-3"></i>
              Replit으로 시작하기
            </Button>
            
            <div className="text-center text-ios-gray text-sm">
              또는
            </div>
            
            <div className="space-y-2">
              <Button 
                onClick={() => {/* TODO: Google OAuth */}}
                variant="outline"
                className="w-full bg-white hover:bg-gray-100 text-gray-900 py-3 text-sm font-medium rounded-xl border-gray-300"
              >
                <i className="fab fa-google mr-3 text-red-500"></i>
                Google로 계속하기
              </Button>
              
              <Button 
                onClick={() => {/* TODO: Naver OAuth */}}
                variant="outline"
                className="w-full bg-green-500 hover:bg-green-600 text-white py-3 text-sm font-medium rounded-xl"
              >
                <span className="mr-3 font-bold">N</span>
                네이버로 계속하기
              </Button>
              
              <Button 
                onClick={() => {/* TODO: Kakao OAuth */}}
                variant="outline"
                className="w-full bg-yellow-400 hover:bg-yellow-500 text-gray-900 py-3 text-sm font-medium rounded-xl"
              >
                <i className="fas fa-comment mr-3"></i>
                카카오로 계속하기
              </Button>
            </div>
          </div>
          
          <p className="text-xs text-ios-gray mt-6">
            로그인하면 지역별 투표에 참여하고 새로운 투표를 생성할 수 있습니다.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
