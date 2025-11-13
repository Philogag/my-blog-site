<template>
    <a :href="config.link" style="display: flex; justify-content: center; align-items: center; height: 100%;">
        <img :src="config.icon"></img>
    </a>
</template>
<script setup lang="ts">
const config = {
    link: "https://devops.philogag.com/philogag/my-blog-site",
    icon: "https://devops.philogag.com/api/badges/philogag/my-blog-site/status.svg",
}
</script>