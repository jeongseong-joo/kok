import { Link, useLocation } from "wouter";

interface BottomNavigationProps {
  currentPage: "home" | "messages" | "settings";
}

export default function BottomNavigation({ currentPage }: BottomNavigationProps) {
  const [location] = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-ios-card border-t border-gray-800 z-20">
      <div className="flex items-center justify-around py-2 pb-safe">
        <Link href="/">
          <button className={`flex flex-col items-center space-y-1 p-2 ${
            currentPage === "home" ? "text-ios-blue" : "text-ios-gray"
          }`}>
            <i className="fas fa-home text-lg"></i>
            <span className="text-xs">홈</span>
          </button>
        </Link>
        
        <Link href="/messages">
          <button className={`flex flex-col items-center space-y-1 p-2 ${
            currentPage === "messages" ? "text-ios-blue" : "text-ios-gray"
          }`}>
            <i className="far fa-comment-dots text-lg"></i>
            <span className="text-xs">내 대화</span>
          </button>
        </Link>
        
        <Link href="/settings">
          <button className={`flex flex-col items-center space-y-1 p-2 ${
            currentPage === "settings" ? "text-ios-blue" : "text-ios-gray"
          }`}>
            <i className="fas fa-cog text-lg"></i>
            <span className="text-xs">설정</span>
          </button>
        </Link>
      </div>
    </nav>
  );
}
