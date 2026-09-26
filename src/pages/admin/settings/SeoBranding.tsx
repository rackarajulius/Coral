import { useState, useCallback, useMemo } from "react";
import { SeoSettingsSection } from "@/components/adminDashboard/settings/seo-branding/SeoSettingsSection";
import { BrandingSection } from "@/components/adminDashboard/settings/seo-branding/BrandingSection";
import { SocialSharingSection } from "@/components/adminDashboard/settings/seo-branding/SocialSharingSection";
import { BannersSection } from "@/components/adminDashboard/settings/seo-branding/BannersSection";
import { BannerEditor } from "@/components/adminDashboard/settings/seo-branding/BannerEditor";
import {
  SeoSettings, BrandingSettings, SocialSharingSettings, Banner,
  defaultSeoSettings, defaultBrandingSettings, defaultSocialSettings, mockBanners,
} from "@/data/admin/seo-branding/seoBranding";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";

export default function SeoBranding() {
  const [seo, setSeo] = useState<SeoSettings>({ ...defaultSeoSettings });
  const [branding, setBranding] = useState<BrandingSettings>({ ...defaultBrandingSettings });
  const [social, setSocial] = useState<SocialSharingSettings>({ ...defaultSocialSettings });
  const [banners, setBanners] = useState<Banner[]>(mockBanners);

  const [savedState, setSavedState] = useState({
    seo: JSON.stringify(defaultSeoSettings),
    branding: JSON.stringify(defaultBrandingSettings),
    social: JSON.stringify(defaultSocialSettings),
  });

  const isDirty = useMemo(() => {
    return (
      JSON.stringify(seo) !== savedState.seo ||
      JSON.stringify(branding) !== savedState.branding ||
      JSON.stringify(social) !== savedState.social
    );
  }, [seo, branding, social, savedState]);

  const [selectedBanner, setSelectedBanner] = useState<Banner | null>(null);
  const [bannerEditorOpen, setBannerEditorOpen] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const handleSave = useCallback(() => {
    const newSaved = {
      seo: JSON.stringify(seo),
      branding: JSON.stringify(branding),
      social: JSON.stringify(social),
    };
    setSavedState(newSaved);
    toast.success("Changes saved successfully");
  }, [seo, branding, social]);

  const handleReset = useCallback(() => {
    setSeo(JSON.parse(savedState.seo));
    setBranding(JSON.parse(savedState.branding));
    setSocial(JSON.parse(savedState.social));
    setShowResetConfirm(false);
    toast("Changes reset to last saved state");
  }, [savedState]);

  const handleBannerSelect = (banner: Banner) => {
    setSelectedBanner({ ...banner });
    setBannerEditorOpen(true);
  };

  const handleBannerCreate = () => {
    setSelectedBanner({
      id: crypto.randomUUID(),
      message: "",
      type: "info",
      startDate: new Date().toISOString().split("T")[0],
      endDate: new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0],
      status: "draft",
      enabled: false,
      targetPages: ["all"],
    });
    setBannerEditorOpen(true);
  };

  const handleBannerSave = (banner: Banner) => {
    setBanners((prev) => {
      const exists = prev.find((b) => b.id === banner.id);
      if (exists) return prev.map((b) => (b.id === banner.id ? banner : b));
      return [...prev, banner];
    });
    setBannerEditorOpen(false);
    toast.success("Banner saved");
  };

  const handleBannerDelete = (id: string) => {
    setBanners((prev) => prev.filter((b) => b.id !== id));
    setBannerEditorOpen(false);
    toast.success("Banner deleted");
  };

  return (
    <>
       <div className="space-y-6 p-6 md:p-8">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground font-display">
              SEO & Branding
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage search visibility, metadata, and brand identity
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              size="sm"
              variant="outline"
              onClick={() => isDirty ? setShowResetConfirm(true) : null}
              disabled={!isDirty}
            >
              Reset
            </Button>
            <Button
             size="sm"
              variant="default"
              onClick={handleSave}
              disabled={!isDirty}

            >
              Save Changes
            </Button>
          </div>
        </div>

         <Separator className="mb-6" />

        <SeoSettingsSection settings={seo} onChange={setSeo} />

        <div className="border-t border-border" />

        <BrandingSection settings={branding} onChange={setBranding} />

        <div className="border-t border-border" />

        <SocialSharingSection settings={social} onChange={setSocial} />

        <div className="border-t border-border" />

        <BannersSection
          banners={banners}
          onSelect={handleBannerSelect}
          onCreateNew={handleBannerCreate}
        />
      </div>

      <BannerEditor
        banner={selectedBanner}
        open={bannerEditorOpen}
        onOpenChange={setBannerEditorOpen}
        onSave={handleBannerSave}
        onDelete={handleBannerDelete}
      />

      <AlertDialog open={showResetConfirm} onOpenChange={setShowResetConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset all changes?</AlertDialogTitle>
            <AlertDialogDescription>
              This will revert all unsaved changes to the last saved state.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleReset}>Reset</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
