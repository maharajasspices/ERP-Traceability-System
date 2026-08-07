REVOKE EXECUTE ON FUNCTION public.fms_is_qa_viewer(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fms_is_qa_viewer(uuid) TO authenticated;