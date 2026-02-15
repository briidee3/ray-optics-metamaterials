<template>
  <div class="sidebar-tab-placeholder">
    <div class="sidebar-tab-placeholder-title">Surface Editor</div>
    <div class="sidebar-tab-placeholder-body">
      Placeholder UI (coming soon).
    </div>
  </div>
</template>

<script>
/*
TODO:
- add button to open or close surface editor
- add JSON editor for surface json in surface editor
*/

export default {
  name: 'SurfaceEditorTab'
}
</script>

<style scoped>
.sidebar-tab-placeholder {
  padding: 12px;
  color: rgba(255, 255, 255, 0.8);
}

.sidebar-tab-placeholder-title {
  font-weight: 600;
  margin-bottom: 8px;
  color: rgba(255, 255, 255, 0.9);
}

.sidebar-tab-placeholder-body {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.7);
}
</style>


