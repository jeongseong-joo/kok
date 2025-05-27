import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { Region } from "@shared/schema";

interface RegionSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (region: Region) => void;
  selectedRegion: Region | null;
}

export default function RegionSelector({ 
  isOpen, 
  onClose, 
  onSelect, 
  selectedRegion 
}: RegionSelectorProps) {
  const [activeLevel, setActiveLevel] = useState<string>("country");
  const [selectedProvince, setSelectedProvince] = useState<Region | null>(null);
  const queryClient = useQueryClient();

  // 모달이 닫힐 때만 상태 초기화
  useEffect(() => {
    if (!isOpen) {
      setActiveLevel("country");
      setSelectedProvince(null);
    }
  }, [isOpen]);

  const { data: regions = [] } = useQuery<Region[]>({
    queryKey: ["/api/regions"],
    enabled: isOpen,
  });

  const setSelectedRegionMutation = useMutation({
    mutationFn: async (regionId: number) => {
      await apiRequest("POST", "/api/user/selected-region", { regionId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/selected-region"] });
    },
  });

  const countryRegions = regions.filter(r => r.level === "country");
  const provinceRegions = regions.filter(r => r.level === "province");
  const cityRegions = regions.filter(r => r.level === "city" && selectedProvince && r.parentId === selectedProvince.id);





  const handleRegionSelect = (region: Region) => {
    if (region.level === "province" && activeLevel === "province") {
      setSelectedProvince(region);
      setActiveLevel("city");
      return;
    }
    
    // 최종 지역 선택시에만 모달을 닫고 지역을 설정
    setSelectedRegionMutation.mutate(region.id);
    onSelect(region);
    onClose();
  };

  const canSelectCurrentLevel = () => {
    if (activeLevel === "country") return true;
    if (activeLevel === "province") return true;
    if (activeLevel === "city") return selectedProvince !== null;
    return false;
  };

  const handleDirectSelect = () => {
    if (activeLevel === "country" && countryRegions.length > 0) {
      const countryRegion = countryRegions[0];
      setSelectedRegionMutation.mutate(countryRegion.id);
      onSelect(countryRegion);
      onClose();
    } else if (activeLevel === "province" && selectedProvince) {
      setSelectedRegionMutation.mutate(selectedProvince.id);
      onSelect(selectedProvince);
      onClose();
    } else if (activeLevel === "city" && selectedProvince) {
      setSelectedRegionMutation.mutate(selectedProvince.id);
      onSelect(selectedProvince);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-ios-card border-gray-700 text-white max-w-md mx-4 rounded-3xl">
        <DialogTitle className="sr-only">지역 선택</DialogTitle>
        <div className="p-6">
          <div className="w-12 h-1 bg-gray-600 rounded-full mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold mb-6 text-center">지역 선택</h2>
          
          {/* Level Tabs */}
          <div className="flex mb-6 bg-gray-800 rounded-xl p-1">
            <button
              onClick={() => setActiveLevel("country")}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                activeLevel === "country"
                  ? "bg-ios-blue text-white"
                  : "text-ios-gray hover:text-white"
              }`}
            >
              전국
            </button>
            <button
              onClick={() => setActiveLevel("province")}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                activeLevel === "province"
                  ? "bg-ios-blue text-white"
                  : "text-ios-gray hover:text-white"
              }`}
            >
              도/시
            </button>
            <button
              onClick={() => {
                if (!selectedProvince) {
                  setActiveLevel("province");
                } else {
                  setActiveLevel("city");
                }
              }}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                activeLevel === "city"
                  ? "bg-ios-blue text-white"
                  : "text-ios-gray hover:text-white"
              }`}
            >
              시/군/구
            </button>
          </div>

          {/* Direct Selection Button */}
          {canSelectCurrentLevel() && (
            <div className="mb-4">
              <Button
                onClick={handleDirectSelect}
                className="w-full bg-ios-blue hover:bg-ios-blue/90 text-white rounded-xl py-3"
              >
                {activeLevel === "country" && "전국 선택"}
                {activeLevel === "province" && selectedProvince && `${selectedProvince.name} 선택`}
                {activeLevel === "city" && selectedProvince && `${selectedProvince.name} 전체 선택`}
              </Button>
            </div>
          )}

          {/* Breadcrumb */}
          {selectedProvince && activeLevel === "city" && (
            <div className="mb-4 flex items-center space-x-2 text-sm text-ios-gray">
              <button 
                onClick={() => {
                  setSelectedProvince(null);
                  setActiveLevel("province");
                }}
                className="hover:text-white"
              >
                <i className="fas fa-arrow-left mr-1"></i>
                {selectedProvince.name}
              </button>
              <span>/</span>
              <span>시/군/구</span>
            </div>
          )}

          {/* Region List */}
          <div className="max-h-80 overflow-y-auto space-y-2">
            {activeLevel === "country" && countryRegions.map((region) => (
              <Button
                key={region.id}
                onClick={() => handleRegionSelect(region)}
                variant="ghost"
                className={`w-full justify-start p-3 rounded-xl transition-colors ${
                  selectedRegion?.id === region.id
                    ? "bg-ios-blue/30 text-white border border-ios-blue"
                    : "text-white hover:bg-gray-700"
                }`}
              >
                {region.name}
              </Button>
            ))}

            {activeLevel === "province" && provinceRegions.map((region) => (
              <Button
                key={region.id}
                onClick={() => handleRegionSelect(region)}
                variant="ghost"
                className={`w-full justify-between p-3 rounded-xl transition-colors ${
                  selectedRegion?.id === region.id
                    ? "bg-ios-blue/30 text-white border border-ios-blue"
                    : "text-white hover:bg-gray-700"
                }`}
              >
                <span>{region.name}</span>
                <i className="fas fa-chevron-right text-xs text-ios-gray"></i>
              </Button>
            ))}

            {activeLevel === "city" && cityRegions.map((region) => (
              <Button
                key={region.id}
                onClick={() => handleRegionSelect(region)}
                variant="ghost"
                className={`w-full justify-start p-3 rounded-xl transition-colors ${
                  selectedRegion?.id === region.id
                    ? "bg-ios-blue/30 text-white border border-ios-blue"
                    : "text-white hover:bg-gray-700"
                }`}
              >
                {region.name}
              </Button>
            ))}



            {activeLevel === "city" && selectedProvince && cityRegions.length === 0 && (
              <div className="text-center py-8 text-ios-gray">
                <i className="fas fa-map-marker-alt text-2xl mb-2"></i>
                <p>해당 지역의 시/군/구 정보가 없습니다</p>
                <p className="text-xs mt-2">상위 지역을 선택하거나 다른 지역을 선택해주세요</p>
              </div>
            )}

            {activeLevel === "city" && !selectedProvince && (
              <div className="text-center py-8 text-ios-gray">
                <i className="fas fa-arrow-up text-2xl mb-2"></i>
                <p>먼저 도/시를 선택해주세요</p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
