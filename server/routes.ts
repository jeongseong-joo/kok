import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { insertVoteSchema, insertUserVoteSchema } from "@shared/schema";
import { z } from "zod";

const createVoteRequestSchema = z.object({
  question: z.string().min(1, "Question is required"),
  regionId: z.number(),
  isActive: z.boolean().optional().default(true),
  endsAt: z.string().datetime().optional().nullable(),
  options: z.array(z.string()).min(2, "At least 2 options are required"),
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Initialize default regions if they don't exist
  await initializeRegions();

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Region routes
  app.get('/api/regions', async (req, res) => {
    try {
      const level = req.query.level as string;
      const regions = level 
        ? await storage.getRegionsByLevel(level)
        : await storage.getAllRegions();
      res.json(regions);
    } catch (error) {
      console.error("Error fetching regions:", error);
      res.status(500).json({ message: "Failed to fetch regions" });
    }
  });

  app.get('/api/user/selected-region', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const region = await storage.getUserSelectedRegion(userId);
      res.json(region);
    } catch (error) {
      console.error("Error fetching user selected region:", error);
      res.status(500).json({ message: "Failed to fetch selected region" });
    }
  });

  app.post('/api/user/selected-region', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { regionId } = req.body;
      
      if (!regionId) {
        return res.status(400).json({ message: "Region ID is required" });
      }

      await storage.setUserSelectedRegion(userId, regionId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error setting user selected region:", error);
      res.status(500).json({ message: "Failed to set selected region" });
    }
  });

  // Vote routes
  app.get('/api/votes', async (req, res) => {
    try {
      const regionId = parseInt(req.query.regionId as string);
      const userId = (req as any).user?.claims?.sub;
      const searchQuery = req.query.search as string;
      const sortBy = req.query.sortBy as 'participants' | 'newest' | 'oldest';
      
      // 디버깅을 위한 로그
      console.log('Search params:', { regionId, searchQuery, sortBy });
      
      if (!regionId) {
        return res.status(400).json({ message: "Region ID is required" });
      }

      const votes = await storage.getVotesByRegionHierarchy(regionId, userId, searchQuery, sortBy);
      res.json(votes);
    } catch (error) {
      console.error("Error fetching votes:", error);
      res.status(500).json({ message: "Failed to fetch votes" });
    }
  });

  app.get('/api/votes/:id', async (req, res) => {
    try {
      const voteId = parseInt(req.params.id);
      const userId = (req as any).user?.claims?.sub;
      
      const vote = await storage.getVoteById(voteId, userId);
      if (!vote) {
        return res.status(404).json({ message: "Vote not found" });
      }

      res.json(vote);
    } catch (error) {
      console.error("Error fetching vote:", error);
      res.status(500).json({ message: "Failed to fetch vote" });
    }
  });

  app.post('/api/votes', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const validatedData = createVoteRequestSchema.parse(req.body);
      
      const voteData = {
        question: validatedData.question,
        creatorId: userId,
        regionId: validatedData.regionId,
        isActive: validatedData.isActive ?? true,
        endsAt: validatedData.endsAt ? new Date(validatedData.endsAt) : null,
      };

      const vote = await storage.createVote(voteData, validatedData.options);
      res.status(201).json(vote);
    } catch (error) {
      console.error("Error creating vote:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid vote data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create vote" });
    }
  });

  app.post('/api/votes/:id/cast', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const voteId = parseInt(req.params.id);
      const { optionId } = req.body;

      if (!optionId) {
        return res.status(400).json({ message: "Option ID is required" });
      }

      await storage.castVote(userId, voteId, optionId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error casting vote:", error);
      if (error instanceof Error && error.message.includes("already voted")) {
        return res.status(400).json({ message: error.message });
      }
      res.status(500).json({ message: "Failed to cast vote" });
    }
  });

  app.put('/api/votes/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const voteId = parseInt(req.params.id);
      const { question, options } = req.body;

      if (!question || !options || !Array.isArray(options) || options.length < 2) {
        return res.status(400).json({ message: "Invalid vote data" });
      }

      const updatedVote = await storage.updateVote(voteId, userId, question, options);
      res.json(updatedVote);
    } catch (error) {
      console.error("Error updating vote:", error);
      if (error instanceof Error && error.message.includes("권한이 없습니다")) {
        return res.status(403).json({ message: error.message });
      }
      res.status(500).json({ message: "Failed to update vote" });
    }
  });

  app.delete('/api/votes/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const voteId = parseInt(req.params.id);

      await storage.deleteVote(voteId, userId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting vote:", error);
      if (error instanceof Error && error.message.includes("권한이 없습니다")) {
        return res.status(403).json({ message: error.message });
      }
      res.status(500).json({ message: "Failed to delete vote" });
    }
  });

  // Like routes
  app.post('/api/votes/:id/like', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const voteId = parseInt(req.params.id);

      console.log("Like API called:", { userId, voteId });

      const liked = await storage.toggleLike(userId, voteId);
      const likesCount = await storage.getLikesCount(voteId);

      console.log("Like result:", { liked, likesCount });

      const response = { liked, likesCount };
      res.json(response);
    } catch (error) {
      console.error("Error toggling like:", error);
      res.status(500).json({ message: "Failed to toggle like" });
    }
  });

  // Comment routes
  app.get('/api/votes/:id/comments', async (req, res) => {
    try {
      const voteId = parseInt(req.params.id);
      const comments = await storage.getCommentsByVote(voteId);
      res.json(comments);
    } catch (error) {
      console.error("Error fetching comments:", error);
      res.status(500).json({ message: "Failed to fetch comments" });
    }
  });

  app.post('/api/votes/:id/comments', isAuthenticated, async (req: any, res) => {
    console.log("Comment API called - Route reached!");
    try {
      const voteId = parseInt(req.params.id);
      const userId = req.user.claims.sub;
      const { text } = req.body;

      console.log("Creating comment:", { voteId, userId, content: text, body: req.body });

      if (!text || text.trim() === '') {
        return res.status(400).json({ message: "Comment text is required" });
      }

      const newComment = await storage.createComment({
        voteId,
        userId,
        content: text.trim(),
      });

      console.log("Comment created successfully:", newComment);
      res.json(newComment);
    } catch (error) {
      console.error("Error creating comment:", error);
      res.status(500).json({ message: "Failed to create comment" });
    }
  });

  app.delete('/api/comments/:id', isAuthenticated, async (req: any, res) => {
    try {
      const commentId = parseInt(req.params.id);
      const userId = req.user.claims.sub;
      
      await storage.deleteComment(commentId, userId);
      res.json({ message: "Comment deleted successfully" });
    } catch (error) {
      console.error("Error deleting comment:", error);
      res.status(500).json({ message: "Failed to delete comment" });
    }
  });

  // Get user's comments
  app.get('/api/user/comments', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const comments = await storage.getUserComments(userId);
      res.json(comments);
    } catch (error) {
      console.error("Error fetching user comments:", error);
      res.status(500).json({ message: "Failed to fetch user comments" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

async function initializeRegions() {
  try {
    const existingRegions = await storage.getAllRegions();
    const cityRegions = existingRegions.filter(r => r.level === "city");
    
    // If we already have provinces but missing city regions, add them
    if (existingRegions.length > 0 && cityRegions.length < 200) {
      console.log("Adding missing city regions...");
      
      // Find existing provinces
      const provinces = existingRegions.filter(r => r.level === "province");
      
      // Add Busan districts
      const busanProvince = provinces.find(p => p.name === "부산광역시");
      if (busanProvince) {
        const existingBusanCities = cityRegions.filter(c => c.parentId === busanProvince.id);
        if (existingBusanCities.length === 0) {
          const busanDistricts = [
            "해운대구", "수영구", "사하구", "부산진구", "동래구", "남구",
            "중구", "서구", "영도구", "금정구", "연제구", "사상구"
          ];

          for (const districtName of busanDistricts) {
            await storage.createRegion({
              name: districtName,
              level: "city",
              parentId: busanProvince.id,
            });
          }
          console.log("Added Busan districts");
        }
      }

      // Add Gyeonggi cities
      const gyeonggiProvince = provinces.find(p => p.name === "경기도");
      if (gyeonggiProvince) {
        const existingGyeonggiCities = cityRegions.filter(c => c.parentId === gyeonggiProvince.id);
        if (existingGyeonggiCities.length === 0) {
          const gyeonggiCities = [
            "수원시", "성남시", "고양시", "용인시", "부천시", "안산시",
            "안양시", "남양주시", "화성시", "평택시", "의정부시", "시흥시", "군포시", "하남시", "오산시", "이천시", "안성시", "김포시", "양주시", "동두천시", "구리시", "포천시", "의왕시", "과천시", "광명시", "연천군", "가평군", "양평군"
          ];

          for (const cityName of gyeonggiCities) {
            await storage.createRegion({
              name: cityName,
              level: "city",
              parentId: gyeonggiProvince.id,
            });
          }
          console.log("Added Gyeonggi cities");
        }
      }

      // Add Incheon districts
      const incheonProvince = provinces.find(p => p.name === "인천광역시");
      if (incheonProvince) {
        const existingIncheonCities = cityRegions.filter(c => c.parentId === incheonProvince.id);
        if (existingIncheonCities.length === 0) {
          const incheonDistricts = [
            "중구", "동구", "미추홀구", "연수구", "남동구", "부평구",
            "계양구", "서구", "강화군", "옹진군"
          ];

          for (const districtName of incheonDistricts) {
            await storage.createRegion({
              name: districtName,
              level: "city",
              parentId: incheonProvince.id,
            });
          }
          console.log("Added Incheon districts");
        }
      }

      // Add Daegu districts
      const daeguProvince = provinces.find(p => p.name === "대구광역시");
      if (daeguProvince) {
        const existingDaeguCities = cityRegions.filter(c => c.parentId === daeguProvince.id);
        if (existingDaeguCities.length === 0) {
          const daeguDistricts = [
            "중구", "동구", "서구", "남구", "북구", "수성구", "달서구", "달성군"
          ];

          for (const districtName of daeguDistricts) {
            await storage.createRegion({
              name: districtName,
              level: "city",
              parentId: daeguProvince.id,
            });
          }
          console.log("Added Daegu districts");
        }
      }

      // Add Gwangju districts
      const gwangjuProvince = provinces.find(p => p.name === "광주광역시");
      if (gwangjuProvince) {
        const existingGwangjuCities = cityRegions.filter(c => c.parentId === gwangjuProvince.id);
        if (existingGwangjuCities.length === 0) {
          const gwangjuDistricts = [
            "동구", "서구", "남구", "북구", "광산구"
          ];

          for (const districtName of gwangjuDistricts) {
            await storage.createRegion({
              name: districtName,
              level: "city",
              parentId: gwangjuProvince.id,
            });
          }
          console.log("Added Gwangju districts");
        }
      }

      // Add Daejeon districts
      const daejeonProvince = provinces.find(p => p.name === "대전광역시");
      if (daejeonProvince) {
        const existingDaejeonCities = cityRegions.filter(c => c.parentId === daejeonProvince.id);
        if (existingDaejeonCities.length === 0) {
          const daejeonDistricts = [
            "중구", "동구", "서구", "유성구", "대덕구"
          ];

          for (const districtName of daejeonDistricts) {
            await storage.createRegion({
              name: districtName,
              level: "city",
              parentId: daejeonProvince.id,
            });
          }
          console.log("Added Daejeon districts");
        }
      }

      // Add Ulsan districts
      const ulsanProvince = provinces.find(p => p.name === "울산광역시");
      if (ulsanProvince) {
        const existingUlsanCities = cityRegions.filter(c => c.parentId === ulsanProvince.id);
        if (existingUlsanCities.length === 0) {
          const ulsanDistricts = [
            "중구", "남구", "동구", "북구", "울주군"
          ];

          for (const districtName of ulsanDistricts) {
            await storage.createRegion({
              name: districtName,
              level: "city",
              parentId: ulsanProvince.id,
            });
          }
          console.log("Added Ulsan districts");
        }
      }

      // Add Gangwon cities
      const gangwonProvince = provinces.find(p => p.name === "강원도");
      if (gangwonProvince) {
        const existingGangwonCities = cityRegions.filter(c => c.parentId === gangwonProvince.id);
        if (existingGangwonCities.length === 0) {
          const gangwonCities = [
            "춘천시", "원주시", "강릉시", "동해시", "태백시", "속초시", "삼척시",
            "홍천군", "횡성군", "영월군", "평창군", "정선군", "철원군", "화천군", "양구군", "인제군", "고성군", "양양군"
          ];

          for (const cityName of gangwonCities) {
            await storage.createRegion({
              name: cityName,
              level: "city",
              parentId: gangwonProvince.id,
            });
          }
          console.log("Added Gangwon cities");
        }
      }

      // Add Chungbuk cities
      const chungbukProvince = provinces.find(p => p.name === "충청북도");
      if (chungbukProvince) {
        const existingChungbukCities = cityRegions.filter(c => c.parentId === chungbukProvince.id);
        if (existingChungbukCities.length === 0) {
          const chungbukCities = [
            "청주시", "충주시", "제천시", "보은군", "옥천군", "영동군", "증평군", "진천군", "괴산군", "음성군", "단양군"
          ];

          for (const cityName of chungbukCities) {
            await storage.createRegion({
              name: cityName,
              level: "city",
              parentId: chungbukProvince.id,
            });
          }
          console.log("Added Chungbuk cities");
        }
      }

      // Add Chungnam cities
      const chungnamProvince = provinces.find(p => p.name === "충청남도");
      if (chungnamProvince) {
        const existingChungnamCities = cityRegions.filter(c => c.parentId === chungnamProvince.id);
        if (existingChungnamCities.length === 0) {
          const chungnamCities = [
            "천안시", "공주시", "보령시", "아산시", "서산시", "논산시", "계룡시",
            "금산군", "부여군", "서천군", "청양군", "홍성군", "예산군", "태안군"
          ];

          for (const cityName of chungnamCities) {
            await storage.createRegion({
              name: cityName,
              level: "city",
              parentId: chungnamProvince.id,
            });
          }
          console.log("Added Chungnam cities");
        }
      }

      // Add Jeonbuk cities
      const jeonbukProvince = provinces.find(p => p.name === "전라북도");
      if (jeonbukProvince) {
        const existingJeonbukCities = cityRegions.filter(c => c.parentId === jeonbukProvince.id);
        if (existingJeonbukCities.length === 0) {
          const jeonbukCities = [
            "전주시", "군산시", "익산시", "정읍시", "남원시", "김제시",
            "완주군", "진안군", "무주군", "장수군", "임실군", "순창군", "고창군", "부안군"
          ];

          for (const cityName of jeonbukCities) {
            await storage.createRegion({
              name: cityName,
              level: "city",
              parentId: jeonbukProvince.id,
            });
          }
          console.log("Added Jeonbuk cities");
        }
      }

      // Add Jeonnam cities
      const jeonnamProvince = provinces.find(p => p.name === "전라남도");
      if (jeonnamProvince) {
        const existingJeonnamCities = cityRegions.filter(c => c.parentId === jeonnamProvince.id);
        if (existingJeonnamCities.length === 0) {
          const jeonnamCities = [
            "목포시", "여수시", "순천시", "나주시", "광양시",
            "담양군", "곡성군", "구례군", "고흥군", "보성군", "화순군", "장흥군", "강진군", "해남군", "영암군", "무안군", "함평군", "영광군", "장성군", "완도군", "진도군", "신안군"
          ];

          for (const cityName of jeonnamCities) {
            await storage.createRegion({
              name: cityName,
              level: "city",
              parentId: jeonnamProvince.id,
            });
          }
          console.log("Added Jeonnam cities");
        }
      }

      // Add Gyeongbuk cities
      const gyeongbukProvince = provinces.find(p => p.name === "경상북도");
      if (gyeongbukProvince) {
        const existingGyeongbukCities = cityRegions.filter(c => c.parentId === gyeongbukProvince.id);
        if (existingGyeongbukCities.length === 0) {
          const gyeongbukCities = [
            "포항시", "경주시", "김천시", "안동시", "구미시", "영주시", "영천시", "상주시", "문경시", "경산시",
            "군위군", "의성군", "청송군", "영양군", "영덕군", "청도군", "고령군", "성주군", "칠곡군", "예천군", "봉화군", "울진군", "울릉군"
          ];

          for (const cityName of gyeongbukCities) {
            await storage.createRegion({
              name: cityName,
              level: "city",
              parentId: gyeongbukProvince.id,
            });
          }
          console.log("Added Gyeongbuk cities");
        }
      }

      // Add Gyeongnam cities
      const gyeongnamProvince = provinces.find(p => p.name === "경상남도");
      if (gyeongnamProvince) {
        const existingGyeongnamCities = cityRegions.filter(c => c.parentId === gyeongnamProvince.id);
        if (existingGyeongnamCities.length === 0) {
          const gyeongnamCities = [
            "창원시", "진주시", "통영시", "사천시", "김해시", "밀양시", "거제시", "양산시",
            "의령군", "함안군", "창녕군", "고성군", "남해군", "하동군", "산청군", "함양군", "거창군", "합천군"
          ];

          for (const cityName of gyeongnamCities) {
            await storage.createRegion({
              name: cityName,
              level: "city",
              parentId: gyeongnamProvince.id,
            });
          }
          console.log("Added Gyeongnam cities");
        }
      }

      // Add Jeju cities
      const jejuProvince = provinces.find(p => p.name === "제주특별자치도");
      if (jejuProvince) {
        const existingJejuCities = cityRegions.filter(c => c.parentId === jejuProvince.id);
        if (existingJejuCities.length === 0) {
          const jejuCities = [
            "제주시", "서귀포시"
          ];

          for (const cityName of jejuCities) {
            await storage.createRegion({
              name: cityName,
              level: "city",
              parentId: jejuProvince.id,
            });
          }
          console.log("Added Jeju cities");
        }
      }

      // Add Sejong cities (세종특별자치시는 단일 행정구역)
      const sejongProvince = provinces.find(p => p.name === "세종특별자치시");
      if (sejongProvince) {
        const existingSejongCities = cityRegions.filter(c => c.parentId === sejongProvince.id);
        if (existingSejongCities.length === 0) {
          await storage.createRegion({
            name: "세종시",
            level: "city",
            parentId: sejongProvince.id,
          });
          console.log("Added Sejong city");
        }
      }
      
      console.log("All city regions update completed");
      return;
    }
    
    if (existingRegions.length > 0) return;

    // Create default Korean regions
    const country = await storage.createRegion({
      name: "대한민국",
      level: "country",
      parentId: null,
    });

    const provinces = [
      "서울특별시", "부산광역시", "대구광역시", "인천광역시", 
      "광주광역시", "대전광역시", "울산광역시", "세종특별자치시",
      "경기도", "강원도", "충청북도", "충청남도", "전라북도", 
      "전라남도", "경상북도", "경상남도", "제주특별자치도"
    ];

    const createdProvinces = [];
    for (const provinceName of provinces) {
      const province = await storage.createRegion({
        name: provinceName,
        level: "province",
        parentId: country.id,
      });
      createdProvinces.push(province);
    }

    // Add districts for major cities
    const seoulProvince = createdProvinces.find(p => p.name === "서울특별시");
    if (seoulProvince) {
      const seoulDistricts = [
        "강남구", "서초구", "마포구", "종로구", "중구", "용산구",
        "성동구", "광진구", "동대문구", "중랑구", "성북구", "강북구"
      ];

      for (const districtName of seoulDistricts) {
        await storage.createRegion({
          name: districtName,
          level: "city",
          parentId: seoulProvince.id,
        });
      }
    }

    // Add Busan districts
    const busanProvince = createdProvinces.find(p => p.name === "부산광역시");
    if (busanProvince) {
      const busanDistricts = [
        "해운대구", "수영구", "사하구", "부산진구", "동래구", "남구",
        "중구", "서구", "영도구", "금정구", "연제구", "사상구"
      ];

      for (const districtName of busanDistricts) {
        await storage.createRegion({
          name: districtName,
          level: "city",
          parentId: busanProvince.id,
        });
      }
    }

    // Add Gyeonggi cities
    const gyeonggiProvince = createdProvinces.find(p => p.name === "경기도");
    if (gyeonggiProvince) {
      const gyeonggiCities = [
        "수원시", "성남시", "고양시", "용인시", "부천시", "안산시",
        "안양시", "남양주시", "화성시", "평택시", "의정부시", "시흥시"
      ];

      for (const cityName of gyeonggiCities) {
        await storage.createRegion({
          name: cityName,
          level: "city",
          parentId: gyeonggiProvince.id,
        });
      }
    }

    // Add Incheon districts
    const incheonProvince = createdProvinces.find(p => p.name === "인천광역시");
    if (incheonProvince) {
      const incheonDistricts = [
        "중구", "동구", "미추홀구", "연수구", "남동구", "부평구",
        "계양구", "서구", "강화군", "옹진군"
      ];

      for (const districtName of incheonDistricts) {
        await storage.createRegion({
          name: districtName,
          level: "city",
          parentId: incheonProvince.id,
        });
      }
    }

    console.log("Default regions initialized");
  } catch (error) {
    console.error("Error initializing regions:", error);
  }
}
