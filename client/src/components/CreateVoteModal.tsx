import { useState } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Region } from "@shared/schema";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import RegionSelector from "./RegionSelector";

interface CreateVoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedRegion: Region | null;
  onSuccess: () => void;
}

export default function CreateVoteModal({ 
  isOpen, 
  onClose, 
  selectedRegion, 
  onSuccess 
}: CreateVoteModalProps) {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [duration, setDuration] = useState("1"); // days
  const [customDate, setCustomDate] = useState<Date | undefined>(undefined);
  const [showRegionSelector, setShowRegionSelector] = useState(false);
  const [tempSelectedRegion, setTempSelectedRegion] = useState<Region | null>(selectedRegion);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: regions = [] } = useQuery<Region[]>({
    queryKey: ["/api/regions"],
  });

  const createVoteMutation = useMutation({
    mutationFn: async (voteData: any) => {
      await apiRequest("POST", "/api/votes", voteData);
    },
    onSuccess: () => {
      toast({
        title: "투표 생성 완료",
        description: "투표가 성공적으로 생성되었습니다!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/votes"] });
      handleClose();
      onSuccess();
    },
    onError: (error: any) => {
      toast({
        title: "투표 생성 실패",
        description: error.message || "투표 생성 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    },
  });

  const handleClose = () => {
    setQuestion("");
    setOptions(["", ""]);
    setDuration("1");
    setCustomDate(undefined);
    setTempSelectedRegion(selectedRegion);
    onClose();
  };

  const addOption = () => {
    if (options.length < 6) {
      setOptions([...options, ""]);
    }
  };

  const removeOption = (index: number) => {
    if (options.length > 2) {
      setOptions(options.filter((_, i) => i !== index));
    }
  };

  const updateOption = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const handleSubmit = () => {
    if (!question.trim()) {
      toast({
        title: "오류",
        description: "투표 질문을 입력해주세요.",
        variant: "destructive",
      });
      return;
    }

    const validOptions = options.filter(opt => opt.trim());
    if (validOptions.length < 2) {
      toast({
        title: "오류",
        description: "최소 2개의 선택지를 입력해주세요.",
        variant: "destructive",
      });
      return;
    }

    if (!tempSelectedRegion) {
      toast({
        title: "오류",
        description: "지역을 선택해주세요.",
        variant: "destructive",
      });
      return;
    }

    let endsAt: string | null = null;
    if (duration === "custom" && customDate) {
      endsAt = customDate.toISOString();
    } else if (duration !== "unlimited") {
      const endDate = new Date(Date.now() + parseInt(duration) * 24 * 60 * 60 * 1000);
      endsAt = endDate.toISOString();
    }

    createVoteMutation.mutate({
      question: question.trim(),
      regionId: tempSelectedRegion.id,
      isActive: true,
      endsAt,
      options: validOptions,
    });
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="bg-ios-card border-gray-700 text-white max-w-md mx-4 max-h-[80vh] overflow-y-auto rounded-3xl">
        <DialogTitle className="sr-only">투표 만들기</DialogTitle>
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <Button
              onClick={handleClose}
              variant="ghost"
              className="text-ios-blue font-medium p-0 h-auto"
            >
              취소
            </Button>
            <h2 className="text-lg font-semibold">투표 만들기</h2>
            <Button
              onClick={handleSubmit}
              disabled={createVoteMutation.isPending}
              variant="ghost"
              className="text-ios-blue font-medium p-0 h-auto"
            >
              {createVoteMutation.isPending ? "생성중..." : "완료"}
            </Button>
          </div>

          <div className="space-y-6">
            {/* Vote Question */}
            <div>
              <label className="block text-sm font-medium mb-2 text-ios-gray">
                투표 질문
              </label>
              <Textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="투표하고 싶은 질문을 입력해주세요"
                className="bg-gray-800 border-gray-600 text-white placeholder-ios-gray rounded-xl focus:ring-ios-blue focus:border-ios-blue"
                rows={3}
              />
            </div>

            {/* Vote Options */}
            <div>
              <label className="block text-sm font-medium mb-2 text-ios-gray">
                선택 옵션
              </label>
              <div className="space-y-3">
                {options.map((option, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <Input
                      value={option}
                      onChange={(e) => updateOption(index, e.target.value)}
                      placeholder={`옵션 ${index + 1}`}
                      className="flex-1 bg-gray-800 border-gray-600 text-white placeholder-ios-gray rounded-xl focus:ring-ios-blue focus:border-ios-blue"
                    />
                    {options.length > 2 && (
                      <Button
                        onClick={() => removeOption(index)}
                        variant="ghost"
                        size="sm"
                        className="text-ios-red hover:text-ios-red/80 p-2"
                      >
                        <i className="fas fa-times"></i>
                      </Button>
                    )}
                  </div>
                ))}
                {options.length < 6 && (
                  <Button
                    onClick={addOption}
                    variant="ghost"
                    className="w-full bg-gray-800 hover:bg-gray-700 text-ios-gray rounded-xl p-4 border border-dashed border-gray-600"
                  >
                    <i className="fas fa-plus mr-2"></i>
                    옵션 추가
                  </Button>
                )}
              </div>
            </div>

            {/* Vote Duration */}
            <div>
              <label className="block text-sm font-medium mb-2 text-ios-gray">
                투표 기간
              </label>
              <Select value={duration} onValueChange={setDuration}>
                <SelectTrigger className="bg-gray-800 border-gray-600 text-white rounded-xl focus:ring-ios-blue focus:border-ios-blue">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-600 text-white">
                  <SelectItem value="1" className="text-white hover:bg-gray-700">1일</SelectItem>
                  <SelectItem value="7" className="text-white hover:bg-gray-700">1주일</SelectItem>
                  <SelectItem value="30" className="text-white hover:bg-gray-700">1개월</SelectItem>
                  <SelectItem value="custom" className="text-white hover:bg-gray-700">직접 선택</SelectItem>
                  <SelectItem value="unlimited" className="text-white hover:bg-gray-700">무제한</SelectItem>
                </SelectContent>
              </Select>
              
              {duration === "custom" && (
                <div className="mt-3">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full bg-gray-800 border-gray-600 text-white hover:bg-gray-700 rounded-xl justify-start"
                      >
                        <i className="fas fa-calendar mr-2"></i>
                        {customDate ? format(customDate, "yyyy년 MM월 dd일", { locale: ko }) : "날짜 선택"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 bg-gray-800 border-gray-600">
                      <Calendar
                        mode="single"
                        selected={customDate}
                        onSelect={setCustomDate}
                        disabled={(date) => date < new Date()}
                        className="rounded-xl"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              )}
            </div>

            {/* Region Selection */}
            <div>
              <label className="block text-sm font-medium mb-2 text-ios-gray">
                투표 지역
              </label>
              <Button
                onClick={() => setShowRegionSelector(true)}
                variant="outline"
                className="w-full bg-gray-800 border-gray-600 text-white hover:bg-gray-700 rounded-xl justify-between p-4"
              >
                <span>
                  {tempSelectedRegion?.name || "지역을 선택해주세요"}
                </span>
                <i className="fas fa-chevron-right text-ios-gray"></i>
              </Button>
            </div>
          </div>
        </div>
        
        {/* Region Selector Modal */}
        {showRegionSelector && (
          <RegionSelector
            isOpen={showRegionSelector}
            onClose={() => setShowRegionSelector(false)}
            onSelect={(region) => {
              setTempSelectedRegion(region);
              setShowRegionSelector(false);
            }}
            selectedRegion={tempSelectedRegion}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
