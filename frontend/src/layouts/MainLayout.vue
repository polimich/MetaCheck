<script setup lang="ts">
import { ref } from 'vue';
import { NavLink, NavLinkProps } from 'components';

defineOptions({
  name: 'MainLayout',
});

const linksList: NavLinkProps[] = [
  {
    title: 'Collections',
    icon: 'code',
    link: '/collections',
  },
  {
    title: 'Dev',
    icon: 'code',
    link: '/dev',
  },
];

const leftDrawerOpen = ref(false);

function toggleLeftDrawer() {
  leftDrawerOpen.value = !leftDrawerOpen.value;
}
</script>

<template>
  <q-layout view="hHh lpR fFf">
    <q-header elevated>
      <q-toolbar>
        <q-btn
          flat
          dense
          round
          icon="menu"
          aria-label="Menu"
          @click="toggleLeftDrawer"
        />
        <q-toolbar-title> MetaCheck </q-toolbar-title>
      </q-toolbar>
    </q-header>

    <q-drawer v-model="leftDrawerOpen" bordered>
      <q-list>
        <q-item-label header> Menu </q-item-label>
        <NavLink v-for="link in linksList" :key="link.title" v-bind="link" />
      </q-list>
    </q-drawer>

    <q-page-container>
      <router-view />
    </q-page-container>
  </q-layout>
</template>
